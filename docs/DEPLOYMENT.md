# Deployment

FriendlyBets is a Next.js app on Vercel with a Neon Postgres database provisioned through
the Vercel marketplace — the same setup as `times-tables`.

## Current deployment

| | |
|---|---|
| Site | https://bets.gilbyy.com |
| Vercel project | `nevin-gilbert-s-projects/friendlybets` |
| Database | Neon, added with `vercel integration add neon` |
| Google OAuth client | `525073490980-i2iev0h7g951oj85e8af9vr8oc6cbp1v.apps.googleusercontent.com` |

The old Supabase project (`ickmpbuxgzxznalzjbdz`) is paused and no longer used. Its data
was carried over with `npm run db:import-supabase` — see [section 5](#5-importing-the-old-supabase-data).

---

## 1. Database

```bash
vercel link
vercel integration add neon
vercel env pull .env.local
```

The integration connects the database to the Vercel project and writes `DATABASE_URL` (the
pooled string, used at runtime) and `DATABASE_URL_UNPOOLED` (direct, used for migrations)
into every environment.

Then create the schema:

```bash
npm run db:migrate
```

Migrations live in `db/migrations/`, are applied in filename order, and are recorded in
`schema_migrations`, so re-running is a no-op. Each file runs as one transaction. They are
append-only: never edit one that has been applied — add the next number.

## 2. Google sign-in

The existing OAuth client is reused. Auth.js uses a different callback path from Supabase,
so the client needs these **Authorized redirect URIs** (Google Cloud console → APIs &
Services → Credentials → the web client):

```
https://bets.gilbyy.com/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
```

The old `https://ickmpbuxgzxznalzjbdz.supabase.co/auth/v1/callback` entry can be removed
once the move is live.

A missing or wrong entry fails with `redirect_uri_mismatch` on Google's screen. To see
which callback the deployment is actually generating without signing in, request
`/api/auth/signin/google` and read the `redirect_uri` in the redirect.

## 3. Environment variables

| Name | Where it comes from |
|---|---|
| `DATABASE_URL` | Neon integration (pooled) |
| `DATABASE_URL_UNPOOLED` | Neon integration (direct) |
| `AUTH_SECRET` | `openssl rand -base64 33` |
| `AUTH_GOOGLE_ID` | the OAuth client ID above |
| `AUTH_GOOGLE_SECRET` | the OAuth client secret — Google Cloud console |
| `AUTH_URL` | production only: `https://bets.gilbyy.com` |

All are server-only. Nothing is prefixed `NEXT_PUBLIC_`, and `npm run check:secrets` fails the
verify if any of them appears in the client bundle.

**Set `AUTH_URL` in production.** Without it the OAuth callback is built from whichever host
served the page, so opening the app on a deployment or alias URL produces a `redirect_uri`
Google does not know. Because it is production-only, Google sign-in does not work on preview
deployments; that is expected.

**Share only `bets.gilbyy.com`.** Vercel Deployment Protection is on for every domain except
custom ones, so the `*.vercel.app` addresses sit behind *your* Vercel login and friends
following an invite link there get bounced. The custom domain is public; the app does its
own access control.

If anything is missing, every page shows a "Not finished setting up" notice naming it, rather
than a sign-in button that silently bounces.

## 4. Deploying

Push to `main`; Vercel builds with `next build`. Run `npm run db:migrate` against Neon
*before* deploying code that needs a new migration.

Locally:

```bash
cp .env.example .env.local   # or: vercel env pull .env.local
npm run db:migrate
npm run dev                  # http://localhost:3000
```

## 5. Importing the old Supabase data

One-off, and already done for the production database. Kept for the record and in case it
needs repeating.

1. Download a backup of the paused Supabase project from its dashboard (the paused project's
   page, or Database → Backups). Keep it out of git — `.gitignore` already excludes
   `*.backup` and `*.sql.gz`, because it contains every user's email address.
2. Dry run — reads the file and prints counts, writes nothing:

   ```bash
   npm run db:import-supabase -- path/to/backup.sql.gz
   ```

3. Import:

   ```bash
   npm run db:import-supabase -- path/to/backup.sql.gz --write
   ```

The importer reads the `COPY` blocks for `public.profiles`, `public.lobbies`,
`public.lobby_members`, `public.bets`, `auth.users` and `auth.identities` straight out of the
dump, so it needs no `psql` or scratch database. Users keep their Supabase ids, gain their
Google subject and email, and reclaim their history on first sign-in. Everything is written in
one transaction and every insert is `on conflict do nothing`, so it is safe to re-run. If
someone signed in to the new app before the import, their imported history is re-pointed at
the account they already have.

A custom-format (binary) dump is detected and refused with the `pg_restore` command that
converts it to plain SQL first.
