# Architecture

## Shape

```
Browser (React SPA on Vercel)
   │
   ├── PostgREST  ── reads, filtered by Row Level Security
   ├── RPC        ── writes, via SECURITY DEFINER functions
   ├── Realtime   ── Postgres change stream, per lobby
   └── GoTrue     ── Google OAuth
                              │
                     Supabase Postgres
```

There is no application server. Vercel serves static files; every dynamic thing is
Supabase.

### Why no server

The previous version ran Express + SQLite + Socket.IO on a laptop, with guests joining
over the host's WiFi. Moving to Vercel forced the issue: Vercel's runtime is serverless,
so it cannot hold the long-lived WebSocket connections Socket.IO depends on. Rather than
find somewhere else to host a socket server, the real-time layer became Supabase
Realtime, which streams Postgres changes over its own WebSocket. Once realtime and the
database both lived in Supabase, the Express layer had nothing left to do.

The practical win: the app works from anywhere, not just from inside one living room.

## Security model

Two rules, and they're what make a serverless client safe:

**Reads go through RLS.** The tables have `SELECT` policies and nothing else. If you
aren't a member of a lobby, its rows do not exist as far as your session is concerned —
you get an empty result, not an error.

**Writes go through RPC.** There are deliberately no `INSERT`, `UPDATE` or `DELETE`
policies on any table. The only way to change data is to call a `SECURITY DEFINER`
function, each of which re-checks `auth.uid()` and lobby membership. A client cannot
issue arbitrary SQL, so the bet lifecycle can't be bypassed by a crafted request.

This also solves the accept race. `accept_bet` does:

```sql
update public.bets
   set status = 'ACCEPTED', acceptor_id = auth.uid(), accepted_at = now()
 where id = p_bet_id and status = 'OPEN'
```

The `status = 'OPEN'` predicate inside the `UPDATE` takes a row lock, so when two people
tap Accept simultaneously exactly one update matches. The loser gets "Someone already
took this bet". No advisory locks, no transaction juggling.

### Recursion in policies

A policy on `lobby_members` cannot itself query `lobby_members` — evaluating the policy
would re-trigger the policy. The membership predicates (`is_lobby_member`,
`is_lobby_host`, `shares_lobby_with`) are therefore `SECURITY DEFINER`, which runs them
as the owner and skips RLS. This is the standard escape hatch and the reason those three
functions exist at all.

### Function grants

Postgres grants `EXECUTE` on new functions to `PUBLIC` by default, and both `anon` and
`authenticated` belong to `PUBLIC`. Revoking from those two roles by name therefore does
nothing — the migration has to revoke from `PUBLIC` itself. Migration `20260817000100`
fixes exactly that mistake in the initial migration; the comments there explain it.

`anon` can execute exactly one function: `lobby_preview`, so an invite link can say who
invited you before you sign in. Everything else requires a session.

## Data model

```
auth.users ──1:1── profiles ──┬── lobbies (host_id)
                              ├── lobby_members (lobby_id, user_id) ── PK on the pair
                              └── bets (creator_id, acceptor_id, winner_id, loser_id)
```

`profiles` is populated by a trigger on `auth.users`, taking `full_name` and `avatar_url`
straight from Google's claims. Nothing else about a user is stored — notably, the phone
numbers the previous version collected are gone.

Profile visibility is scoped: you can read someone's profile only while you share a lobby
with them (`shares_lobby_with`). Leaving a lobby revokes that.

### Bet lifecycle

```
OPEN ──accept──> ACCEPTED ──resolve──> RESOLVED ──complete──> COMPLETED
  │
  └──cancel──> CANCELLED          (creator only, and only while still OPEN)
```

Each transition is one RPC, and each guards its own starting state, so a stale client
tapping a button it shouldn't still get a clean error rather than corrupt data. Resolution
is symmetric — either participant can call the outcome, and the first call stands. That's
a deliberate product choice, not an oversight; see the PRD.

`winner_id`/`loser_id` are derived at resolution: the creator wins when the outcome equals
the side they took.

## Realtime

`useLobbyData(lobbyId)` opens one channel per lobby and subscribes to `bets`,
`lobby_members` and `lobbies`, each filtered server-side by `lobby_id`. RLS applies to the
stream, so a subscription cannot leak another lobby's rows.

Two details worth knowing:

**`REPLICA IDENTITY FULL`.** By default a Postgres `DELETE` emits only the primary key.
A subscription filtered on `lobby_id` would never match those events, so a bet the host
deleted would linger on every other screen. Setting replica identity to full puts the
whole old row in the event.

**Names are resolved client-side.** A realtime payload is the raw `bets` row — columns
only, no joins. Rather than fetch the creator's name on every event, the hook keeps a map
of the lobby roster and looks names up locally. A row that arrived over the wire and a row
that was fetched then render through exactly the same path.

**Reconnects need an explicit resync.** `postgres_changes` streams live WAL and never
replays, so a rejoined channel picks up from *now* — everything that happened while the
socket was down is gone. Phones lock, laptops sleep, WiFi blips, and none of that raises a
channel error, so the hook refetches on three signals: a `SUBSCRIBED` after the first one
(a rejoin), the tab becoming visible, and the browser reporting it is back online. Without
this the app looks alive while its data is frozen — worst on the TV dashboard, which
nobody ever navigates away from to force a remount.

**An empty roster means you were removed.** RLS answers "not a member" with zero rows, not
an error, so a refetch after the host removes you returns `[]` rather than failing. A lobby
always contains at least its host, so the hook treats an empty roster as lost access and
says so instead of silently rendering a lobby with no players in it.

The leaderboard is the one thing recomputed server-side, via `lobby_leaderboard`. Bet
events debounce a refresh of it by 400 ms so a burst of accepts costs one round trip.

## Frontend notes

- **Sign-in renders in place.** Hitting `/lobby/abc` while signed out shows the sign-in
  screen at that URL instead of redirecting home. Google returns you to the same URL, so
  you land where you were going. Invite links depend on this.
- **Derived over synced state.** The share modal opens off a `?welcome=1` query param, the
  ticker wraps its index with `%`, and the rename field falls back to the live lobby name
  until the host types. None of these use an effect to copy state.
- **Code splitting.** The big-screen dashboard and the QR encoder are dynamically
  imported. They're opened on a laptop once, and guests' phones never download them.
