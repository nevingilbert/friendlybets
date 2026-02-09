# Product Requirements Document: Super Bowl Party Betting App

## Overview

A local-network web application that allows guests at a Super Bowl party to create and accept prop bets with custom stakes. The app runs entirely on a single laptop (server, database, and live dashboard) with guests connecting via their phones over the same WiFi network.

The app is not a gambling platform. Stakes are freeform — "take a shot", "do 10 pushups", "wear a funny hat for a quarter" — though monetary stakes are supported if participants choose. Resolution and fulfillment operate on the honor system.

---

## Constraints

- **Zero cost.** Every technology, library, and service used must be free and open source. No paid APIs, no cloud hosting, no subscriptions. The app runs entirely on local hardware. SMS verification uses a self-hosted Android SMS gateway — the only "cost" is a spare Android phone and an existing carrier plan with texting.

## Goals

- Zero-friction betting experience that anyone at the party can use within seconds
- Real-time visibility of all betting activity to drive engagement and energy
- Fully self-contained — no cloud services, no accounts, no app installs
- Simple enough to build and deploy before game day

## Non-Goals

- Automated outcome verification (honor system only)
- Real money payment processing
- Multi-outcome markets (future consideration)
- Persistent data beyond the party (nice-to-have, not required)

---

## User Roles

### Guest
Any party attendee. Can create bets, accept bets, and resolve bets they're involved in.

### Host / Admin
The party organizer. All guest capabilities plus:
- Resolve any bet regardless of participation
- Delete any bet from the system
- Undo bet accepts (revert ACCEPTED → OPEN)
- Configure bet expiration timers
- Access the admin panel at a secret URL (`/admin-x7k9m2`)

Already implemented in v1 via the admin panel.

---

## User Identity & Authentication

### v1 (Current) — Frictionless Registration
- Guests register with a **display name** and **phone number**
- Phone number is the unique identifier and primary key
- If a guest disconnects and reconnects, entering the same phone number restores their session
- No verification — trust-based, optimized for speed

### v2 — SMS Verification (Phone-Based Auth)

True authentication via one-time SMS codes, while keeping everything free and self-hosted.

**Flow:**
1. Guest enters display name + phone number
2. Server sends a 6-digit OTP via SMS
3. Guest enters the code on the verification screen
4. On success, session is established and persisted via localStorage
5. Returning users re-verify with a new OTP (or optionally skip if within a configurable session window)

**Free Implementation Strategy — Android SMS Gateway:**

Since no free cloud SMS API exists at the scale we need without payment info, the recommended approach is to use the host's spare Android phone as a self-hosted SMS gateway.

- **[SMS Gateway for Android](https://github.com/capcom6/android-sms-gateway)** — Free, open-source app that turns any Android phone into an SMS gateway with a local REST API
- The Android device runs on the same WiFi network as the server
- The server calls the gateway's REST API to send OTP messages
- No internet required — SMS is sent via the phone's SIM card and carrier plan
- Supports multiple SIM cards on a single device
- Total cost: $0 (uses existing phone + carrier's unlimited texting)

**Alternative approaches (tradeoffs noted):**
| Approach | Cost | Tradeoff |
|---|---|---|
| Android SMS Gateway (recommended) | Free | Requires a spare Android phone on the same network |
| [Textbelt self-hosted](https://github.com/typpo/textbelt) | Free | Uses email-to-SMS carrier gateways; unreliable, carrier-dependent |
| Twilio free trial | Free (trial credits) | Requires credit card for signup; messages prefixed with trial warning |
| Firebase Auth phone | Free (10/day) | 10 verifications/day limit on free tier — too few for 30 guests |
| Manual verification | Free | Admin reads OTP aloud or confirms in person — fallback only |

**Data model addition:**
```
verification_codes table:
  phone: String (primary key)
  code: String (6-digit)
  created_at: Timestamp
  expires_at: Timestamp
  attempts: Integer (max 3, then lockout for 5 minutes)
```

---

## Core Concepts

### Bet

A bet is a proposition that one or more people can take sides on. It consists of:

| Field | Description |
|---|---|
| Proposition | A freeform yes/no statement (e.g. "Chiefs win the coin toss") |
| Stake | Freeform text describing what's on the line (e.g. "a shot", "$5") |
| Creator | The guest who created the bet |
| Creator Side | "Yes" or "No" — what the creator believes |
| Acceptor(s) | Guest(s) who take the opposite side |
| Market Mode | `ONE_TO_ONE` (default) or `OPEN_MARKET` (v2) |
| Odds Mode | `EVEN` (default) or `MIXED` — whether stakes differ per side (v2) |
| Status | The current lifecycle state of the bet |
| Outcome | The resolved result — Yes or No (null until resolved) |
| Expires At | When the bet auto-cancels if unaccepted (null = no expiry) |
| Created At | Timestamp |

### Bet Lifecycle

```
Open → Accepted → Resolved → Completed
  ↓         ↘
Expired   Cancelled (from Open only)
```

| State | Description |
|---|---|
| **Open** | Created by a guest, visible in the public feed, waiting for someone to accept |
| **Accepted** | Another guest has taken the opposite side. Both parties are locked in. |
| **Resolved** | Either party has declared the outcome (Yes or No happened). The app determines who won and who owes. |
| **Completed** | The losing party has fulfilled their stake (honor system — either party can mark this). |
| **Cancelled** | The creator withdrew the bet before anyone accepted it. |
| **Expired** | The bet was not accepted within the admin-configured time limit and was automatically closed. |

### Stake Matching

#### Even Stakes (v1 — current)

Stakes are **symmetric**. When a guest accepts a bet, they are agreeing to the same stake on the opposite side.

Example:
> **Creator:** "I bet **a shot** that **the first play is a run**" (Side: Yes)
> **Acceptor clicks Accept** → They are betting a shot that the first play is NOT a run (Side: No)
> **Outcome:** First play is a pass → Proposition is No → Creator loses → Creator owes a shot

#### Mixed Odds (v2)

For uneven events where one outcome is far more likely than the other, the creator can set **different stakes for each side** to make the bet attractive.

The creator specifies:
- **"If I win" stake** — what the other party owes the creator if the creator is right
- **"If I lose" stake** — what the creator owes the other party if the creator is wrong

This naturally models odds. The more confident you are, the more you should be willing to risk.

Example:
> **Creator:** "Mahomes throws 4+ interceptions" (Side: Yes, unlikely)
> **If I win (they owe me):** "You buy me dinner"
> **If I lose (I owe them):** "I take a shot"
> **Acceptor sees:** "Take the NO side — if you're right, the creator takes a shot. If you're wrong, you buy them dinner."

The UI shows both stakes clearly so the acceptor can evaluate whether the risk/reward is fair before accepting. No algorithmic odds calculation — it's a negotiation between humans expressed through creative stakes.

**Implementation notes:**
- Add `creator_stake` and `acceptor_stake` fields (both freeform text)
- When `odds_mode = 'EVEN'`, both fields contain the same value (backward compatible with v1's single `stake` field)
- When `odds_mode = 'MIXED'`, each field is set independently by the creator
- The bet card UI shows both stakes: "You risk: X / You win: Y"

### Multi-Person Markets (v2)

In v1, every bet is one-to-one. In v2, the creator can optionally open a bet as an **open market**, allowing multiple guests to accept.

**How it works:**
- Creator sets `market_mode = 'OPEN_MARKET'` and optionally a `max_acceptors` limit (default: unlimited)
- Each acceptor creates a separate **pairing** against the creator — effectively N independent 1:1 bets under one proposition
- The creator is on one side against all acceptors
- On resolution, all pairings resolve simultaneously — the creator either wins all or loses all

**Data model:** A new `pairings` table links multiple acceptors to a single bet:
```
pairings table:
  id: UUID (primary key)
  bet_id: UUID (FK → Bet)
  acceptor_id: UUID (FK → User)
  status: Enum (ACCEPTED, RESOLVED, COMPLETED)
  accepted_at: Timestamp
```

When `market_mode = 'ONE_TO_ONE'`, the existing `acceptor_id` on the bet is used (no pairings row needed, backward compatible).

When `market_mode = 'OPEN_MARKET'`, `acceptor_id` on the bet is null and all acceptors are tracked in the pairings table.

**UI changes:**
- Create Bet modal gains a "Allow multiple takers" toggle
- Bet card shows acceptor count: "3 people have taken this bet"
- Bet detail lists all pairings and their individual completion status
- Dashboard shows market bets with participant counts for extra party energy

### Bet Expiration (v2)

Open bets that go unaccepted can clutter the feed. The admin can configure a **global expiration timer** that auto-cancels stale bets.

**How it works:**
- The admin panel exposes a setting: "Auto-expire unaccepted bets after __ minutes" (default: off / no expiry)
- The value is stored in a `settings` table in SQLite (key-value)
- When a bet is created and expiration is enabled, `expires_at` is set to `created_at + expiration_minutes`
- A server-side interval (runs every 30 seconds) checks for OPEN bets past their `expires_at` and transitions them to `EXPIRED`
- Expired bets emit a `bet:expired` WebSocket event
- The bet card shows a countdown timer when expiration is set: "Expires in 4m 32s"
- The creator can still manually cancel before expiry

**Why admin-only:** Letting each creator set their own timer adds UI complexity. A single global timer keeps things simple and lets the host tune the pace — short timers during fast game action, longer timers during halftime.

### Comments (v2)

Guests can comment on any bet to trash-talk, negotiate, or react.

**How it works:**
- Any logged-in user can post a comment on any bet regardless of status
- Comments appear in a thread below the bet detail view, ordered chronologically
- Comments are broadcast in real-time via Socket.IO (`comment:created` event)
- Comments are text-only, max 280 characters (keep it punchy)
- No editing or deleting by users — admin can delete via admin panel
- Comment count is shown on the bet card in the feed

**Data model:**
```
comments table:
  id: UUID (primary key)
  bet_id: UUID (FK → Bet)
  user_id: UUID (FK → User)
  text: String (max 280 chars)
  created_at: Timestamp
```

### Trending Bets Indicator (v2)

A visual indicator on bets that are generating buzz, making it easy to find the action.

**Trending score algorithm:**

A bet's trending score is calculated as a weighted sum of recent engagement signals:

```
trending_score = (comments_last_10min * 3) + (views_last_10min * 1) + (is_newly_created * 5)
```

- **Comments** are the strongest signal (weight 3) — if people are talking about it, it's hot
- **Views** count unique users who opened the bet detail page in the last 10 minutes (weight 1)
- **Recency bonus** — bets created in the last 5 minutes get a flat +5 boost to surface them

**Implementation approach (keeping it simple and free):**
- Track views in-memory on the server (a `Map<betId, Set<userId>>` with 10-minute rolling window). No database needed — trending is ephemeral.
- Comment counts come from the database
- Recalculate trending scores every 30 seconds via a server interval
- Bets with a score above a threshold (configurable, default: 5) get a "Trending" badge
- The dashboard shows a "Trending Bets" section replacing or supplementing the open bets ticker

**UI:**
- A flame/fire icon + "Trending" pill badge on qualifying bet cards
- Feed gains an optional "Trending" tab/filter that sorts by trending score descending
- Dashboard highlights trending bets in a dedicated section

### Notifications — Reminders to Bet (v2)

Push guests to stay engaged by reminding them to place and resolve bets.

**Strategy:** Since Partiful has no public API, we use two free approaches in combination.

#### Approach 1: Web Push Notifications (Primary — fully free)

Browser-native push notifications that work even when the tab is in the background.

**How it works:**
- On first visit, the app requests notification permission via the [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) + [Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- The server stores push subscriptions (endpoint + keys) per user
- Notifications are sent server-side using the [web-push](https://github.com/web-push-libs/web-push) npm package (free, open source, no external service)
- VAPID keys are generated locally on first server start and stored in the settings table

**Notification triggers:**
| Event | Who gets notified | Message |
|---|---|---|
| New bet created | All users (except creator) | "New bet: '{proposition}' — {stake} on the line!" |
| Your bet was accepted | Creator | "{acceptor} accepted your bet!" |
| Bet resolved | Both participants | "Bet resolved! {winner} wins — {loser} owes {stake}" |
| Unresolved bets reminder | Participants of ACCEPTED bets | "You have {N} unresolved bets — time to call it!" |
| Idle nudge | Users who haven't bet in 30+ min | "The party's heating up! {N} open bets waiting for you" |

**Push subscription data model:**
```
push_subscriptions table:
  id: UUID (primary key)
  user_id: UUID (FK → User)
  endpoint: String
  p256dh: String
  auth: String
  created_at: Timestamp
```

**Limitations:** Web push requires HTTPS in production. On local network, this can be worked around by:
- Using a self-signed certificate (guests accept the browser warning once)
- Or running the push subscription over the local network where browsers are more lenient
- Safari on iOS has limited Web Push support — works on iOS 16.4+ only

#### Approach 2: Partiful Integration (Best-effort — unofficial)

Partiful does not offer an official API. However, the [unofficial Partiful API](https://github.com/cerebralvalley/partiful-api) reverse-engineered from the web app can be used for light integration.

**What's possible:**
- Fetch the guest list from an existing Partiful event (requires a browser auth token from the host's Partiful session)
- Cross-reference Partiful guest names with registered PartyBet users
- Cannot send messages or notifications through Partiful directly

**Practical integration:**
- The admin panel has a "Sync Partiful Guest List" button
- Host pastes their Partiful auth token (obtained from browser dev tools → cookies)
- The server fetches the event's guest list and displays unregistered guests
- The admin can then manually remind those guests via Partiful's own messaging (outside the app)

**This is a convenience feature, not a notification channel.** The auth token expires periodically and requires manual refresh. It should be clearly labeled as experimental.

#### Approach 3: Manual Partiful Reminder (Simplest)

The admin panel shows a "Copy Reminder Message" button that generates a formatted message like:

> "The bets are heating up! {N} open bets on the board right now. Join at http://{LAN_IP}:3000 Open bets: {list of top 3 propositions}"

The host copies this and pastes it into Partiful's group chat, iMessage, or whatever group thread exists for the party. Zero integration needed.

---

## Screens & User Flows

### 1. Registration Screen

**Path:** First screen on load (if no existing session)

- Input: Display name (text)
- Input: Phone number (tel)
- Button: "Join the Party"
- If the phone number already exists, restore the existing session and redirect to the main feed
- Minimal validation — just ensure both fields are non-empty and phone number is plausible

**v2 addition — Verification step:**
- After submitting, a verification screen appears: "Enter the 6-digit code sent to {phone}"
- 6-digit input field (auto-advance between digits)
- "Resend code" link (rate-limited to once per 60 seconds)
- 3 incorrect attempts triggers a 5-minute lockout
- On success, proceed to feed as normal

### 2. Main Feed (Home Screen)

**Path:** `/` (after registration)

The primary screen. Shows all betting activity in reverse chronological order.

**Tabs/Filters:**
- **Open Bets** — Bets waiting to be accepted (excluding your own). Primary view.
- **My Bets** — All bets you've created or accepted, grouped by status.
- **All Activity** — Full feed of all bets in all states.

**Each bet card displays:**
- The proposition text
- The stake (v2: both sides shown for mixed odds bets)
- The creator's name and their side (Yes/No)
- The current status
- Contextual action button (Accept / Resolve / Mark Completed — depending on state and user)
- **v2 additions:**
  - Trending flame badge (if qualifying)
  - Comment count indicator
  - Expiration countdown (if configured)
  - Acceptor count for open market bets ("3 takers")

**Actions from the feed:**
- Tap a bet card to see full details
- "Create Bet" button (persistent, always accessible — floating action button or header button)

### 3. Create Bet Screen

**Path:** Modal or `/create`

- Input: Proposition (text, e.g. "Mahomes throws an interception in the first half")
- Input: Stake (text, e.g. "a shot", "loser does dishes")
- Toggle: Your side — Yes or No
- **v2 additions:**
  - Toggle: "Mixed odds" — reveals separate fields for "If I win, they owe me" and "If I lose, I owe them"
  - Toggle: "Allow multiple takers" — opens bet as an open market
- Button: "Post Bet"
- On submit, bet enters the Open state and appears in the public feed

### 4. Bet Detail Screen

**Path:** `/bet/:id`

Shows full bet information and available actions:

- All bet fields (proposition, stake, creator, acceptor, sides, status, outcome, timestamps)
- **If Open + you are NOT the creator:** "Accept Bet" button
- **If Open + you ARE the creator:** "Cancel Bet" button
- **If Accepted + you are a participant:** "Resolve" button with Yes/No outcome selection
- **If Resolved + you are a participant:** "Mark Completed" button (acknowledges stake was fulfilled)
- **v2 additions:**
  - Expiration countdown timer (if expiration is configured)
  - Mixed odds display: "You risk: X / You win: Y" shown clearly for both sides
  - Participant list (for open market bets with multiple takers)
  - Comment thread — chronological list of comments with author name and timestamp
  - Comment input field at the bottom (text + "Post" button, 280 char max)
  - Trending badge if the bet qualifies
  - Comment count badge

### 5. Live Dashboard (Host Laptop Screen)

**Path:** `/dashboard`

Designed to be displayed on the host laptop's screen for all guests to see. Auto-refreshes in real-time.

**Sections:**

- **Open Bets Ticker** — Scrolling/rotating display of bets waiting to be accepted. Encourages guests to pull out their phones and accept.
- **Recent Activity** — Last N bets that were accepted, resolved, or completed. Shows the action, e.g. "Mike accepted Sarah's bet: a shot on 'First TD is a rush'"
- **Leaderboard / Shame Board** — Ranked list of guests by:
  - Outstanding debts (bets lost but not yet completed)
  - Total bets placed
  - Win/loss record
- **Stats** — Total bets created, accepted, resolved. Keeps energy up.
- **v2 additions:**
  - **Trending Bets** — Dedicated section showing bets with the highest trending scores, replacing or supplementing the ticker
  - **Live Comments Ticker** — Scrolling display of the latest comments across all bets for extra party energy
  - **Market Bets Spotlight** — Open market bets with their participant count highlighted to encourage pile-ons

The dashboard should be visually distinct from the mobile views — larger text, bolder layout, optimized for viewing from across a room.

### 6. Admin Panel

**Path:** `/admin-x7k9m2` (secret URL, no auth required — security through obscurity on local network)

**Current (v1):**
- List all bets with status badges
- "Delete Bet" button — removes any bet entirely
- "Undo Accept" button — reverts ACCEPTED bets back to OPEN

**v2 additions:**
- **Expiration timer setting** — input field: "Auto-expire unaccepted bets after __ minutes" with save button. Set to 0 or blank to disable.
- **Partiful guest sync** — "Sync Partiful Guest List" section with auth token input and guest list display showing who hasn't registered yet
- **Copy reminder message** — generates a formatted message with current open bets and LAN IP for pasting into group chats
- **Comment moderation** — delete individual comments from any bet
- **Notification controls** — toggle idle nudge reminders on/off, configure nudge interval

---

## Real-Time Behavior

All clients (phones and dashboard) must reflect changes in real-time without manual refresh:

- When a bet is created, it appears in all clients' Open Bets feed
- When a bet is accepted, it moves out of Open and into Accepted across all clients
- When a bet is resolved, the outcome and winner/loser are shown immediately
- The dashboard updates continuously
- **v2 additions:**
  - When a comment is posted, it appears instantly in the bet detail thread and dashboard ticker
  - When a bet expires, it transitions to EXPIRED across all clients
  - Trending scores are recalculated every 30 seconds and pushed to clients
  - Web push notifications fire for relevant events (new bet, acceptance, resolution, nudges)

**Implementation approach:** WebSockets for push-based real-time updates. The server broadcasts state changes to all connected clients.

---

## Data Model

### User
```
id: UUID (primary key)
name: String
phone: String (unique, used for session recovery)
verified: Boolean (default false, v2 — set true after SMS OTP)
created_at: Timestamp
```

### Bet
```
id: UUID (primary key)
proposition: String
stake: String (v1 — single symmetric stake)
creator_stake: String (v2 — what creator risks, defaults to stake)
acceptor_stake: String (v2 — what acceptor risks, defaults to stake)
odds_mode: Enum (EVEN, MIXED) (v2 — default EVEN)
market_mode: Enum (ONE_TO_ONE, OPEN_MARKET) (v2 — default ONE_TO_ONE)
max_acceptors: Integer (v2 — null = unlimited, only for OPEN_MARKET)
creator_id: UUID (FK → User)
creator_side: Enum (YES, NO)
acceptor_id: UUID (FK → User, nullable — used for ONE_TO_ONE only)
status: Enum (OPEN, ACCEPTED, RESOLVED, COMPLETED, CANCELLED, EXPIRED)
outcome: Enum (YES, NO, nullable)
winner_id: UUID (FK → User, nullable, derived on resolution)
loser_id: UUID (FK → User, nullable, derived on resolution)
expires_at: Timestamp (nullable — set from admin config on creation)
created_at: Timestamp
accepted_at: Timestamp (nullable)
resolved_at: Timestamp (nullable)
completed_at: Timestamp (nullable)
```

### Pairings (v2 — for OPEN_MARKET bets)
```
id: UUID (primary key)
bet_id: UUID (FK → Bet)
acceptor_id: UUID (FK → User)
status: Enum (ACCEPTED, RESOLVED, COMPLETED)
accepted_at: Timestamp
resolved_at: Timestamp (nullable)
completed_at: Timestamp (nullable)
```

### Comments (v2)
```
id: UUID (primary key)
bet_id: UUID (FK → Bet)
user_id: UUID (FK → User)
text: String (max 280 chars)
created_at: Timestamp
```

### Verification Codes (v2)
```
phone: String (primary key)
code: String (6-digit)
created_at: Timestamp
expires_at: Timestamp
attempts: Integer (max 3 before lockout)
```

### Push Subscriptions (v2)
```
id: UUID (primary key)
user_id: UUID (FK → User)
endpoint: String
p256dh: String
auth: String
created_at: Timestamp
```

### Settings (v2)
```
key: String (primary key)
value: String
```

Used for admin-configurable values:
- `expiration_minutes` — global bet expiration timer (0 = disabled)
- `vapid_public_key` / `vapid_private_key` — generated on first start for web push
- `nudge_enabled` — whether idle nudge notifications are active
- `nudge_interval_minutes` — how long before nudging idle users

---

## Technical Architecture

### Deployment Model

Everything runs on a single laptop connected to the party's WiFi network.

```
[Guest Phone] ←→ WiFi ←→ [Host Laptop]
[Guest Phone] ←→ WiFi ←→   - Web Server
[Guest Phone] ←→ WiFi ←→   - Database
[Dashboard]   ←→ (localhost) - Frontend (Dashboard view)
```

Guests navigate to the laptop's local IP address (e.g. `http://192.168.1.100:3000`) on their phone browser. No app install needed.

### Recommended Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Server** | Node.js + Express | Fast to build, good WebSocket support |
| **Database** | SQLite (better-sqlite3) | Zero-config, file-based, runs locally, no DB server needed |
| **Real-time** | Socket.IO (WebSockets) | Reliable real-time push with fallback to polling |
| **Frontend** | React (Vite) | Component-based, fast development, good mobile UX |
| **Styling** | Tailwind CSS | Rapid UI development, responsive out of the box |
| **Push Notifications** (v2) | web-push (npm) | Free, open-source VAPID-based web push — no external service |
| **SMS Gateway** (v2) | Android SMS Gateway (self-hosted) | Free, open-source, runs on a spare Android phone on the LAN |

### Networking

- The server binds to `0.0.0.0:3000` so it's accessible from any device on the local network
- On startup, the app prints the local IP and port for the host to share (or display a QR code)
- No HTTPS required (local network, no sensitive data beyond phone numbers)

---

## API Endpoints (REST + WebSocket)

### REST — v1 (implemented)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/users` | Register or restore session (name + phone) |
| GET | `/api/users/:id` | Get user profile and stats |
| DELETE | `/api/bets/:id/admin-delete` | Admin: remove a bet entirely |
| POST | `/api/bets` | Create a new bet |
| GET | `/api/bets` | List bets (filterable by status, user) |
| GET | `/api/bets/:id` | Get bet detail |
| POST | `/api/bets/:id/accept` | Accept an open bet |
| POST | `/api/bets/:id/cancel` | Cancel an open bet (creator only) |
| POST | `/api/bets/:id/resolve` | Resolve a bet with outcome (participant only) |
| POST | `/api/bets/:id/complete` | Mark stake as fulfilled (participant only) |
| GET | `/api/bets/leaderboard/data` | Get leaderboard data |
| POST | `/api/bets/:id/admin-undo-accept` | Admin: revert accepted bet to open |

### REST — v2 (new endpoints)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/send-code` | Send OTP to phone number via SMS gateway |
| POST | `/api/auth/verify-code` | Verify OTP and establish session |
| POST | `/api/bets/:id/comments` | Post a comment on a bet |
| GET | `/api/bets/:id/comments` | List comments for a bet |
| DELETE | `/api/bets/:id/comments/:commentId` | Admin: delete a comment |
| GET | `/api/bets/trending` | Get bets sorted by trending score |
| GET | `/api/settings` | Get admin settings (public subset) |
| PUT | `/api/settings` | Admin: update settings (expiration, nudge config) |
| POST | `/api/push/subscribe` | Register a push subscription for the current user |
| DELETE | `/api/push/subscribe` | Unregister push subscription |
| POST | `/api/admin/sync-partiful` | Sync guest list from Partiful (auth token in body) |
| GET | `/api/admin/reminder-message` | Generate formatted reminder message for clipboard |

### WebSocket Events

| Event | Direction | Payload | Version |
|---|---|---|---|
| `bet:created` | Server → All | Full bet object | v1 |
| `bet:accepted` | Server → All | Bet ID + acceptor info | v1 |
| `bet:resolved` | Server → All | Bet ID + outcome + winner/loser | v1 |
| `bet:completed` | Server → All | Bet ID | v1 |
| `bet:cancelled` | Server → All | Bet ID | v1 |
| `stats:updated` | Server → All | Updated leaderboard/stats | v1 |
| `bet:expired` | Server → All | Bet ID | v2 |
| `comment:created` | Server → All | Comment object + bet ID | v2 |
| `comment:deleted` | Server → All | Comment ID + bet ID | v2 |
| `trending:updated` | Server → All | Array of { betId, score } | v2 |

---

## Edge Cases & Rules

- **Self-acceptance:** A user cannot accept their own bet.
- **Double-acceptance (ONE_TO_ONE):** Once a bet is accepted, no one else can accept it. First come, first served (enforced server-side).
- **Market capacity (OPEN_MARKET, v2):** If `max_acceptors` is set, the server rejects accepts beyond the limit. Race conditions handled via SQLite transaction.
- **Resolution disputes:** Since either participant can resolve, there's a theoretical conflict. For v1, the first resolution stands. This is an honor-system app — trust the guests.
- **Disconnection:** Session is tied to phone number. Reconnecting with the same phone number restores everything. No data is lost (SQLite persists to disk).
- **Name collisions:** Two guests with the same name is fine — phone number is the real identifier. Display names are cosmetic.
- **Empty states:** The feed should have friendly messaging when there are no open bets ("No bets yet — be the first!").
- **Expiration race (v2):** If a guest clicks "Accept" at the same moment a bet expires, the server checks expiry inside a transaction. If expired, the accept fails with a friendly message.
- **Mixed odds display (v2):** Both stakes must be clearly visible before accepting. The accept button should show "You risk: {acceptor_stake} / You win: {creator_stake}" to prevent confusion.
- **Comment spam (v2):** Rate-limited to 1 comment per user per bet per 10 seconds (server-enforced).
- **OTP brute force (v2):** 3 failed attempts locks the phone number for 5 minutes. Codes expire after 10 minutes.
- **SMS gateway offline (v2):** If the Android SMS gateway is unreachable, fall back to displaying the OTP in the server console for the admin to read aloud (party setting, physical proximity).

---

## Future Considerations (Out of Scope for v2)

- **Multi-outcome markets:** A single proposition with 3+ possible outcomes (e.g. "Who scores the first TD?" with a list of players). Requires a different bet-matching model.
- **Automated resolution:** Integration with a free sports data API to auto-resolve common prop bets.
- **Persistent history:** Export bet history after the party (CSV, shareable link, etc.).
- **Pre-game market seeding:** The host pre-creates a set of common Super Bowl prop bets before guests arrive.
- **QR code join:** Display a QR code on the dashboard that guests scan to connect instantly.
- **Counter-offers:** Acceptor proposes a different stake, creating a negotiation flow before the bet locks in.
- **Bet categories/tags:** Categorize bets (e.g. "Game", "Halftime", "Commercials", "Side bets") for filtering.
- **Reaction emojis:** Quick emoji reactions on bets as a lightweight alternative to commenting.

---

## Success Criteria

- A guest can go from opening their phone browser to placing a bet in under 30 seconds (v1) or 60 seconds with SMS verification (v2)
- All connected clients see bet updates within 1 second
- The dashboard is readable from 10+ feet away
- The system handles 20-30 concurrent users without degradation
- The app runs for 5+ hours (full game + pre/post) without crashing
- **v2 additions:**
  - Comments appear in real-time within 1 second of posting
  - Trending indicators update within 30 seconds of engagement changes
  - Expired bets transition within 30 seconds of their expiry time
  - Push notifications arrive within 5 seconds of the triggering event
  - SMS OTP delivery within 10 seconds of request

---

## Implementation Priorities

### Phase 1 — Minimum Viable Party (MVP) [COMPLETE]
1. User registration with phone-based session recovery
2. Create and accept bets
3. Real-time feed with WebSocket updates
4. Resolve and complete bets
5. Basic mobile-responsive UI
6. Live dashboard for the host laptop
7. Leaderboard / shame board
8. Stats and activity feed
9. Admin panel (delete bets, undo accepts)

### Phase 2 — Engagement Features
10. Commenting on bets (comments table, real-time thread, comment count on cards)
11. Trending bets indicator (in-memory scoring, flame badge, trending tab/section)
12. Bet expiration (admin-configurable timer, countdown on cards, server-side expiry sweep)

### Phase 3 — Market Depth
13. Mixed odds / asymmetric stakes (separate creator_stake and acceptor_stake fields)
14. Multi-person open markets (pairings table, multiple acceptors per bet)

### Phase 4 — Authentication & Notifications
15. SMS phone verification via Android SMS Gateway (verification_codes table, OTP flow)
16. Web push notifications (push_subscriptions table, web-push npm package, VAPID keys)
17. Idle nudge reminders (server interval, configurable in admin settings)
18. Partiful guest list sync (unofficial API, best-effort)
19. Copy-to-clipboard reminder message generator

### Phase 5 — Polish
20. QR code for easy joining
21. Sound effects for bet events
22. Export/share results after the party
