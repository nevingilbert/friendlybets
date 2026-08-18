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

## Verified in production

Exercised end to end on 2026-08-18 by two real accounts on separate devices: Google
sign-in, create lobby, join via invite link (63 seconds from link to lobby), post a bet,
accept it, resolve it, mark the stake paid. Winner derivation and the standings'
owes-vs-settled split both came out correct.

## Loose ends

Not features — things that are built but have never been looked at, or facts about the
deployment that were never pinned down.

- [ ] **Open the big-screen dashboard** (`/lobby/<id>/dashboard`). It passes its
      data-layer checks but has never been loaded in a browser. It is the room display —
      ticker, activity feed, standings, join QR code — so it deserves a look before it
      goes on a TV in front of people.
- [ ] **Click through the host controls** (`/lobby/<id>/manage`): rename, lock, archive,
      remove a player, delete a bet, undo an accidental accept. All are enforced and
      tested in Postgres; the UI paths are unexercised.
- [ ] **Pin down the OAuth consent screen's publishing status** —
      [console](https://console.cloud.google.com/auth/audience?project=525073490980).
      A second unrelated account signed in without being added anywhere, which strongly
      suggests it is already published. If it is *not*, the tell is everyone getting
      signed out roughly 7 days apart, because Testing mode expires refresh tokens
      weekly and caps you at 100 users. Publishing is instant with no verification
      review, since the app requests only `email profile` (non-sensitive scopes).
      The consent screen is shared with wellness-planner, but publishing does not
      loosen that app — it gates on its own `allowed_users` table plus RLS, not on
      Google's test-user list.
- [ ] **Confirm realtime updates arrive without a refresh** across two devices. The
      subscriptions and the reconnect resync are in place and correct at the database
      level, but nobody has explicitly confirmed a bet appearing on a second screen
      untouched.

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
