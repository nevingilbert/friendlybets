# FriendlyBets

Create a lobby, send your friends the link, and bet each other on anything.

Stakes are freeform — "a shot", "the dishes", "wear a funny hat for a quarter". Nothing
is wagered for real money and nothing is verified automatically; resolution runs on the
honour system between the two people in a bet.

**Live:** https://bets.gilbyy.com

Runs on Next.js + Neon. Google sign-in needs the Auth.js callback added to the OAuth
client — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#2-google-sign-in).

---

## How it works

1. Someone signs in with Google and **creates a lobby**. They become its host.
2. They **share the invite** — a link (`/join/XK4P2M`), a six-character code, or a QR code
   on the big-screen view.
3. Friends open the link, sign in with Google, and land in the lobby.
4. Anyone posts a bet: a yes/no proposition, a freeform stake, and which side they're on.
5. Someone else takes the other side. Either participant calls the outcome, and the loser
   marks the stake paid.

Everything is scoped to a lobby. You only ever see the bets, players, and standings of
lobbies you've actually joined — that boundary is enforced by Postgres, not by the UI.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS v4 |
| Hosting | Vercel |
| Database | Neon Postgres via the Vercel integration, `postgres` driver |
| Auth | Auth.js (NextAuth v5) — Google only, JWT sessions |
| Live updates | Polling a per-lobby snapshot endpoint every 3 s while visible |

Server Components read, Server Actions write, and every write is one plpgsql function that
checks permissions and enforces the bet lifecycle. The browser never talks to the database.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for why, and for the move off Supabase.

## Running locally

```bash
npm install
cp .env.example .env.local     # or: vercel env pull .env.local
npm run db:migrate
npm run dev                    # http://localhost:3000
```

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run verify` | typecheck + lint + unit tests + SQL tests + build + bundle secret scan |
| `npm run test:sql` | Runs the schema and every write guard against PGlite (real Postgres in wasm) |
| `npm run db:migrate` | Apply anything new in `db/migrations/` |
| `npm run db:status` | Applied migrations and row counts |
| `npm run db:import-supabase` | One-off import from a Supabase backup — see DEPLOYMENT.md |

## Layout

```
src/
  app/         routes — thin server pages that load data and render a screen
  screens/     one client screen per route
  components/  shared UI primitives (ui.tsx), plus components/dashboard for TV mode
  hooks/       useLobbyData (polling), useTicker, useOrigin
  lib/         types, validation, formatting; lib/db is the only code that touches Postgres
  server/      Server Actions and error translation
  auth.ts      Auth.js config
db/migrations/ the schema; the only source of truth for permissions
scripts/       migrate, SQL verification, Supabase import, bundle secret scan
docs/          product spec, architecture, deployment, roadmap
```

## Routes

| Route | Who | What |
|---|---|---|
| `/` | anyone | Sign in, or your list of lobbies |
| `/join/:code` | anyone | Invite landing — readable before you sign in |
| `/lobby/:id` | members | The betting feed |
| `/lobby/:id/bet/:betId` | members | One bet, with its actions |
| `/lobby/:id/dashboard` | members | TV mode for a big screen |
| `/lobby/:id/manage` | members | Lobby settings; host-only controls appear for the host |
| `/api/lobby/:id` | members | The live snapshot every lobby screen polls |

## Docs

- [docs/PRD.md](docs/PRD.md) — what the product is and what it deliberately isn't
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — data model, security model, live updates
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Neon, Google OAuth, Vercel, the Supabase import
- [docs/ROADMAP.md](docs/ROADMAP.md) — what's built, what's verified, and the open loose ends
