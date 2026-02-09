# Pending Features

Status of v2 features planned for PartyBet. See [PRD.md](PRD.md) for full specifications.

---

## Phase 2 — Engagement Features

### Comments on Bets
**Status:** Not started
**Priority:** High — drives engagement and trash-talk

- [ ] Create `comments` table (id, bet_id, user_id, text, created_at)
- [ ] `POST /api/bets/:id/comments` — post a comment (280 char max)
- [ ] `GET /api/bets/:id/comments` — list comments for a bet
- [ ] `DELETE /api/bets/:id/comments/:commentId` — admin delete
- [ ] `comment:created` and `comment:deleted` Socket.IO events
- [ ] Comment thread UI on BetDetail page
- [ ] Comment count badge on BetCard in feed
- [ ] Rate limiting: 1 comment per user per bet per 10 seconds
- [ ] Admin panel: comment moderation (delete buttons)

### Trending Bets Indicator
**Status:** Not started
**Priority:** Medium — makes the feed and dashboard more dynamic

- [ ] Server-side in-memory view tracking (`Map<betId, Set<userId>>` with 10-min rolling window)
- [ ] Trending score calculation: `(comments_10min * 3) + (views_10min * 1) + (recency_bonus * 5)`
- [ ] Server interval (every 30s) to recalculate and emit `trending:updated` event
- [ ] `GET /api/bets/trending` endpoint
- [ ] Flame badge on qualifying BetCards (score >= 5)
- [ ] "Trending" tab/filter on Feed page
- [ ] "Trending Bets" section on Dashboard

### Bet Expiration
**Status:** Not started
**Priority:** High — prevents feed clutter during fast game action

- [ ] Create `settings` table (key-value store)
- [ ] Admin panel: "Auto-expire unaccepted bets after __ minutes" input
- [ ] `GET /api/settings` and `PUT /api/settings` endpoints
- [ ] Set `expires_at` on bet creation when expiration is enabled
- [ ] Server interval (every 30s) to sweep expired OPEN bets → EXPIRED status
- [ ] `bet:expired` Socket.IO event
- [ ] Countdown timer on BetCards with expiration set
- [ ] Add `EXPIRED` to status enum and status styles

---

## Phase 3 — Market Depth

### Mixed Odds / Asymmetric Stakes
**Status:** Not started
**Priority:** Medium — makes uneven prop bets more fun

- [ ] Add `creator_stake`, `acceptor_stake`, and `odds_mode` columns to bets table
- [ ] Migrate existing `stake` field → `creator_stake = acceptor_stake = stake` for backward compat
- [ ] Update CreateBetModal: "Mixed odds" toggle reveals separate stake inputs
- [ ] Update BetCard: show "You risk: X / You win: Y" for mixed odds bets
- [ ] Update BetDetail: clear display of both stakes before accept
- [ ] Update resolution logic to assign correct stake text per winner/loser

### Multi-Person Open Markets
**Status:** Not started
**Priority:** Medium — allows group bets for maximum party energy

- [ ] Create `pairings` table (id, bet_id, acceptor_id, status, timestamps)
- [ ] Add `market_mode` and `max_acceptors` columns to bets table
- [ ] Update CreateBetModal: "Allow multiple takers" toggle
- [ ] Update accept logic: create pairing row instead of setting acceptor_id for OPEN_MARKET bets
- [ ] Update resolution logic: resolve all pairings simultaneously
- [ ] Update BetCard: show acceptor count ("3 takers")
- [ ] Update BetDetail: list all pairings with individual completion status
- [ ] Race condition handling: check max_acceptors inside SQLite transaction

---

## Phase 4 — Authentication & Notifications

### SMS Phone Verification
**Status:** Not started
**Priority:** Low — nice-to-have, v1 trust-based auth works fine for a party

Requires a spare Android phone running [SMS Gateway for Android](https://github.com/capcom6/android-sms-gateway) on the same WiFi.

- [ ] Create `verification_codes` table (phone, code, created_at, expires_at, attempts)
- [ ] `POST /api/auth/send-code` — generate OTP, send via SMS gateway REST API
- [ ] `POST /api/auth/verify-code` — validate OTP, establish session
- [ ] Verification screen UI (6-digit input, auto-advance, resend link)
- [ ] Add `verified` column to users table
- [ ] Brute force protection: 3 attempts → 5-min lockout
- [ ] Fallback: display OTP in server console if SMS gateway unreachable

### Web Push Notifications
**Status:** Not started
**Priority:** Medium — keeps guests engaged even when tab is in background

- [ ] Install `web-push` npm package
- [ ] Generate VAPID keys on first server start, store in settings table
- [ ] Create `push_subscriptions` table
- [ ] `POST /api/push/subscribe` and `DELETE /api/push/subscribe` endpoints
- [ ] Client-side: request notification permission on first visit
- [ ] Service worker for receiving push events
- [ ] Notification triggers: new bet, bet accepted, bet resolved
- [ ] Idle nudge: server interval checks for inactive users, sends reminder
- [ ] Admin panel: toggle nudges on/off, configure interval
- [ ] Note: requires HTTPS or self-signed cert for production push

### Partiful Integration
**Status:** Not started
**Priority:** Low — best-effort, unofficial API with expiring auth tokens

- [ ] `POST /api/admin/sync-partiful` — fetch guest list using auth token
- [ ] Admin panel: auth token input + "Sync Guest List" button
- [ ] Display Partiful guests who haven't registered in PartyBet
- [ ] Label as experimental in UI

### Reminder Message Generator
**Status:** Not started
**Priority:** Low — simple but useful

- [ ] `GET /api/admin/reminder-message` — generate formatted message with open bet count, top propositions, and LAN IP
- [ ] Admin panel: "Copy Reminder" button that copies to clipboard
- [ ] Message template: "The bets are heating up! {N} open bets..."

---

## Phase 5 — Polish

- [ ] QR code on dashboard for easy joining (use a free QR library like `qrcode`)
- [ ] Sound effects for bet events (accept, resolve — short audio clips)
- [ ] Export/share results after the party (CSV download or shareable summary)

---

## Contributing

Pick any unchecked item above and submit a PR. Each feature is designed to be implemented independently. Key architectural decisions:

- **Stack:** Node.js + Express, SQLite (better-sqlite3), Socket.IO, React (Vite), Tailwind CSS
- **All real-time:** Every mutation must emit a Socket.IO event
- **Zero cost:** No paid APIs or cloud services. Everything runs on localhost.
- **Backward compatible:** New columns should have defaults. v1 bets should continue to work unchanged.
- **API convention:** Routes go in `server/routes/`. Client API calls use the `api()` helper in `client/src/api.js`.

See [PRD.md](PRD.md) for the full specification of each feature.
