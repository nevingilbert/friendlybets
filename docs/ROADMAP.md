# Roadmap

What exists today, and what's been considered but not built. Specs live in
[PRD.md](PRD.md); this file is only status.

## Built

- Google sign-in, profile provisioned automatically from the Google claims
- Lobbies: create, join by link or six-character code, rename, lock, archive, leave
- Invite flow: shareable link, join code, QR code, native share sheet
- Bets: post, take, cancel, resolve, mark paid — each step guarded in Postgres
- Live updates across every screen in a lobby via Supabase Realtime
- Standings with an "owes" column that clears when a stake is settled
- Big-screen dashboard with ticker, activity feed, standings and a join QR code
- Host moderation: delete a bet, reopen a mistaken accept, remove a player
- Row Level Security isolating every lobby, verified end to end

## Not built

Ordered by how much they'd add relative to their cost.

### Comments on bets
Trash talk is most of the fun and there's nowhere to put it. Needs a `comments` table,
a thread on the bet detail screen, a count on the card, and a realtime subscription.
Rate limiting matters — one comment per person per bet per ten seconds.

### Bet expiry
Open bets that nobody takes clutter the feed during fast-moving events. A host-configurable
timer, `expires_at` set at creation, an `EXPIRED` status, and something to sweep them —
`pg_cron` in Postgres, since there's no longer a Node process to run an interval on.

### Asymmetric stakes
For lopsided propositions, letting the creator set "if I win" and "if I lose" separately
models odds without any odds maths. Adds `creator_stake` / `acceptor_stake` alongside the
existing `stake`. The acceptor must see both before taking it.

### Multiple takers
One bet, several people against the creator. Needs a `pairings` table since a single
`acceptor_id` column can't express it, plus a capacity check inside the accept transaction.

### Push notifications
Web Push via VAPID to pull people back when the tab is backgrounded. Requires storing
subscriptions and something server-side to send them — a Supabase Edge Function, most
likely. iOS only supports this for installed PWAs, which is a real limitation for a
phone-first app.

### Smaller things
- QR code shown on the phone share sheet, not just the big screen
- Sound effects when a bet is taken or resolved
- Export a lobby's history when it's over
- Host pre-seeding a lobby with common propositions
- Trending indicator to surface the bets people are engaging with

## Dropped

Carried in the old spec, deliberately not carried forward:

- **SMS verification via a self-hosted Android gateway.** Solved authentication for the
  old phone-number identity model. Google OAuth solves it better with no spare handset.
- **Partiful guest-list sync.** Depended on an unofficial reverse-engineered API and a
  manually pasted auth token that expires. Sharing a link is simpler and always works.
- **LAN-only operation.** The whole point of moving to Vercel and Supabase was to stop
  requiring everyone on one WiFi network.

## Working on this

- Reads go through RLS; writes go through a `SECURITY DEFINER` function. Adding a mutation
  means adding a function, not an `INSERT` policy — see
  [ARCHITECTURE.md](ARCHITECTURE.md).
- Migrations are append-only. Never edit one that's been applied.
- Anything touching bets should stay live: a change one person makes has to reach every
  other screen without a refresh.
- `npm run lint` and `npm run build` should both pass clean before a commit.
