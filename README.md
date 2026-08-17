# FriendlyBets

Create a lobby, send your friends the link, and bet each other on anything.

Stakes are freeform — "a shot", "the dishes", "wear a funny hat for a quarter". Nothing
is wagered for real money and nothing is verified automatically; resolution runs on the
honour system between the two people in a bet.

**Live:** https://friendlybets-murex.vercel.app

Google sign-in is configured and working. Setting it up on a *new* Supabase project is
the one step with no CLI — see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#1-google-sign-in).

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
| Frontend | React 19 + Vite, Tailwind CSS v4, React Router |
| Hosting | Vercel (static SPA) |
| Database | Supabase Postgres with Row Level Security |
| Realtime | Supabase Realtime (Postgres change streams) |
| Auth | Supabase Auth — Google OAuth only |

There is no application server. The browser talks to Supabase directly; every write goes
through a `SECURITY DEFINER` Postgres function that enforces permissions and the bet
lifecycle. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for why.

## Running locally

```bash
npm install
cp .env.example .env.local     # then fill in both values
npm run dev                    # http://localhost:5173
```

Both env vars come from your Supabase project's API settings. The publishable key is
meant to be public — Row Level Security is what protects the data, not the key.

`npm run dev` binds to your LAN too, so you can open the dev server on a phone using your
laptop's IP to test the mobile layout.

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server, reachable on your LAN |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run db:push` | Apply `supabase/migrations/` to the linked project |
| `npm run db:diff` | Diff local migrations against the linked project |

## Layout

```
src/
  lib/         supabase client, rpc wrappers, formatting helpers
  context/     auth context (auth.js) and its provider (AuthProvider.jsx)
  hooks/       useLobbyData — loads a lobby and subscribes to realtime
  components/  shared UI, plus components/dashboard for the big-screen view
  pages/       one file per route
supabase/
  migrations/  the schema; the only source of truth for permissions
  config.toml  auth + project settings, pushed with `supabase config push`
docs/          product spec, architecture, deployment, roadmap
```

## Routes

| Route | Who | What |
|---|---|---|
| `/` | anyone | Sign in, or your list of lobbies |
| `/join/:code` | anyone | Invite landing — readable before you sign in |
| `/lobby/:id` | members | The betting feed |
| `/lobby/:id/bet/:betId` | members | One bet, with its actions |
| `/lobby/:id/dashboard` | members | Big-screen view for a TV or laptop |
| `/lobby/:id/manage` | members | Lobby settings; host-only controls appear for the host |

## Docs

- [docs/PRD.md](docs/PRD.md) — what the product is and what it deliberately isn't
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — data model, security model, realtime
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Google OAuth, Vercel, Supabase
- [docs/ROADMAP.md](docs/ROADMAP.md) — what's built and what isn't
