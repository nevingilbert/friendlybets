# Architecture

## Shape

```
browser (phone, TV)                          Next.js on Vercel                 Neon Postgres
  page load ─────────────────────────────►  Server Component ── lobby_snapshot() ──►
  every 3s while visible ── GET /api/lobby/[id] ── lobby_snapshot() ─────────────►
  tap a button ── Server Action ── zod ── create_bet() / accept_bet() / … ───────►
  sign in ── Auth.js (Google) ── upsert_user() ──────────────────────────────────►
```

A Next.js App Router app, the same shape as `times-tables` and `dealornodeal`: Server
Components read, Server Actions write, and every write is one plpgsql function. The
browser never talks to the database and never holds a credential; `src/lib/db/*` imports
`server-only`, so an accidental import from a client component fails the build, and
`npm run check:secrets` scans the built client bundle for the connection string.

### Why it moved off Supabase

Until November 2026 this was a Vite SPA talking straight to Supabase (Auth, Postgres with
Row Level Security, Realtime). The free Supabase project was paused for inactivity and
could not be restored without going over the free-tier project limit, which took Google
sign-in — and everything else — down with it. The other apps here already run on Neon via
the Vercel integration, so FriendlyBets moved to the same stack rather than keep a second
provider alive for one app.

Neon is plain Postgres: no auth service, no RLS-from-the-browser, no realtime socket. Each
of those became a server-side piece, described below.

## Security model

The app server is the only database client. Who you are comes from the Auth.js session
(a signed JWT cookie carrying our own `users.id`), and that id is passed into every
function as `p_user_id`. Nothing the browser sends is trusted as an identity.

Permission checks moved from RLS policies into the functions themselves, so they do not
depend on which client calls:

- **Reads** go through `lobby_snapshot(lobby, user)`, which returns `NULL` unless the user is
  a member. `my_lobbies(user)` lists only lobbies you belong to. `lobby_preview(code)` is the
  one read that works signed-out, so an invite link can say who invited you.
- **Writes** each start with their own guard — `require_user`, `is_lobby_member`,
  `is_lobby_host`, or a participant check — and raise a human-readable message when it
  fails. Participant checks use `is distinct from`, which is NULL-safe for an open bet
  that has no acceptor yet.
- **Validation runs three times on purpose:** in the browser for instant feedback, with Zod
  in the Server Action because a client can send anything, and in plpgsql because that is
  the layer nothing can bypass.

`npm run test:sql` replays every one of those guards against real Postgres (PGlite) on
each verify.

## Data model

```
users ──┬── lobbies (host_id)
        ├── lobby_members (lobby_id, user_id) ── PK on the pair
        └── bets (creator_id, acceptor_id, winner_id, loser_id)
```

`users` is keyed on a uuid and carries `google_sub` (unique) and `email`. `upsert_user`
runs on every Google sign-in: it matches on the Google subject first, then on email for a
row that has no subject yet, so a person imported from Supabase reclaims their history the
first time they sign in. `display_name` is set only on the first sign-in — people rename
themselves, and the next sign-in must not undo that.

### Bet lifecycle

```
OPEN ──accept──> ACCEPTED ──resolve──> RESOLVED ──complete──> COMPLETED
  │
  └──cancel──> CANCELLED          (creator only, and only while still OPEN)
```

Each transition is one function, and each guards its own starting state inside the
`UPDATE … WHERE status = …`, so two people accepting at once cannot both win, and a stale
screen tapping a button it should not gets a clean error rather than corrupt data.
Resolution is symmetric — either participant can call the outcome, and the first call
stands. That is a product choice; see the PRD.

`winner_id`/`loser_id` are derived at resolution: the creator wins when the outcome equals
the side they took.

## Live updates

Supabase Realtime is replaced by polling, as in `times-tables`.

- Every lobby page renders its first snapshot on the server, so it arrives complete.
- `useLobbyData` then asks `GET /api/lobby/[id]` every 3 seconds while the tab is visible,
  stops entirely while it is hidden (a phone in a pocket costs nothing, and Neon can scale
  to zero), and asks immediately when the tab wakes or the browser comes back online.
- Each response is the whole lobby — lobby, roster, bets, names, leaderboard — in one
  `lobby_snapshot` round trip. Polling cannot miss an event the way a dropped socket can:
  there is no stream to resync, every answer is the full truth.
- After a write, the screen asks for a fresh snapshot straight away rather than waiting for
  the next tick. A refresh requested while a poll is in flight queues one more poll, because
  the in-flight one may have read the database before the write landed.
- `401/403` from the endpoint means signed out or removed from the lobby, and the screen
  says so. Any other failure keeps what is on screen and tries again next tick, so a
  database blip never kicks anyone off the TV.

`snapshot.names` carries the name of everyone a bet mentions, not just current members, so a
player who left still shows by name on old bets.

LISTEN/NOTIFY over server-sent events was the alternative. It needs a long-lived connection
per open screen, which suits neither serverless functions nor a database that wants to sleep.

## Frontend notes

- **Sign-in renders in place.** Hitting `/lobby/abc` signed out shows the sign-in screen at
  that URL. The sign-in Server Action sends Google back to the same path (only ever a path
  on this site — never an absolute URL), so invite links survive the round trip.
- **Sign-in errors are shown.** Auth.js sends failures to `/?error=…`, and the sign-in
  screen translates the code instead of silently showing the button again.
- **Derived over synced state.** The share modal opens off `?welcome=1`, the ticker wraps
  its index with `%`, and rename fields fall back to the live value until someone types.
- **`useTicker` returns `now`.** Relative timestamps take it as an argument, so the TV's
  "2 minutes ago" captions move without anyone touching it.
- **The QR encoder is dynamically imported**; guests' phones never download it.
