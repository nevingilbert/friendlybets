# Deployment

FriendlyBets is a static SPA on Vercel talking to a Supabase project. There is no server
to run.

## Current deployment

| | |
|---|---|
| Site | https://friendlybets-murex.vercel.app |
| Vercel project | `nevin-gilbert-s-projects/friendlybets` |
| Supabase project | `friendlybets` (`ickmpbuxgzxznalzjbdz`), org Gilbyy, region `us-west-1` |
| Supabase URL | `https://ickmpbuxgzxznalzjbdz.supabase.co` |

---

## 1. Google sign-in

**Status: configured and working** on the project above (verified 2026-08-17 — the
`/auth/v1/authorize` endpoint redirects to Google with a live client ID).

Keep this section for setting up a *new* project or rotating credentials. Google OAuth
credentials can only be created by hand in the Google Cloud console — there is no API or
CLI for it, so this is the one step that cannot be scripted.

### a. Create the OAuth client

1. Open the [Google Cloud console](https://console.cloud.google.com/) and select or
   create a project.
2. **APIs & Services → OAuth consent screen.** Choose **External**, give it an app name
   and your email, and save. While it is in *Testing*, only accounts you add under
   **Test users** can sign in — click **Publish app** when you want it open to everyone.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**, type
   **Web application**.
4. Under **Authorised JavaScript origins** add:
   ```
   https://friendlybets-murex.vercel.app
   http://localhost:5173
   ```
5. Under **Authorised redirect URIs** add exactly this — it is Supabase's callback, not
   the app's:
   ```
   https://ickmpbuxgzxznalzjbdz.supabase.co/auth/v1/callback
   ```
6. Create it, then copy the **Client ID** and **Client secret**.

### b. Give them to Supabase

Either paste them into **Authentication → Sign In / Providers → Google** in the Supabase
dashboard, or push them from the CLI:

```bash
export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET='<client secret>'
supabase config push
```

> [!WARNING]
> `supabase config push` is authoritative: whatever `config.toml` says wins. If you
> enable Google in the dashboard but leave `enabled = false` in `config.toml`, the next
> `config push` silently switches sign-in back off. `config.toml` is therefore kept in
> sync with the dashboard — `enabled = true` and the (public) client ID are committed.
>
> The **secret** is an `env(...)` reference and is never committed. An unset secret
> produces no diff, so a `config push` without it is safe — it will not blank the
> stored credential.

### c. Check it

Open the site, sign in, and confirm you land on the lobby list. If Google returns
`redirect_uri_mismatch`, the redirect URI in step (a5) doesn't match exactly.

---

## 2. Redirect URLs

Already configured, and tracked in `supabase/config.toml` under `[auth]`:

```toml
site_url = "https://friendlybets-murex.vercel.app"
additional_redirect_urls = [
  "http://localhost:5173",
  "http://localhost:5173/**",
  "https://friendlybets-murex.vercel.app/**",
  "https://friendlybets-*-nevin-gilbert-s-projects.vercel.app/**",
]
```

The `/**` globs are load-bearing. An invite link sends the guest back to `/join/<CODE>`
after Google rather than to the site root, and Supabase only permits redirects to
allow-listed URLs. Without the globs, invite links break while plain sign-in still works
— a confusing failure to debug.

If you add a custom domain, add it here and re-run `supabase config push`, and add it to
the Google client's authorised origins too.

---

## 3. Environment variables

Vercel already has these on Production, Preview and Development:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://ickmpbuxgzxznalzjbdz.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |

Both are compiled into the browser bundle and are meant to be public. The publishable key
grants nothing on its own — Row Level Security decides what a request can read or write.
The **secret** key (`sb_secret_…`) bypasses RLS entirely and must never appear in this
app or in any `VITE_`-prefixed variable.

Locally the same two values go in `.env.local`, which is gitignored.

---

## 4. Deploying

The GitHub repo is connected, so **pushing to `main` deploys production** and every pull
request gets its own preview URL. Preview hostnames are already covered by the redirect
allow-list above, so sign-in works on them too.

To deploy without pushing:

```bash
vercel deploy --prod
```

## 5. Database changes

```bash
supabase db push          # apply supabase/migrations/ to the linked project
supabase migration list   # what's applied where
```

Migrations are append-only: never edit one that has been applied, add another. The DB
password is stored in your keychain by `supabase link`; regenerate it from
**Project Settings → Database** if you lose it.
