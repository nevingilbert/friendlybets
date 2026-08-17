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

## 1. Enable Google sign-in (required)

**Nothing else in the app works until this is done.** Signing in will fail with
"Google sign-in has not been switched on for this project yet."

Google OAuth credentials can only be created by hand in the Google Cloud console — there
is no API or CLI for it. This is the one manual step.

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

In `supabase/config.toml`, set `enabled = true` under `[auth.external.google]`, then:

```bash
export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID='<client id>'
export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET='<client secret>'
supabase config push
```

The secret is only ever read from the environment — `config.toml` holds an `env(...)`
reference, so nothing sensitive is committed.

> Prefer clicking? **Authentication → Sign In / Providers → Google** in the Supabase
> dashboard takes the same two values. If you do it there, still set `enabled = true` in
> `config.toml` so the next `config push` doesn't switch it back off.

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

```bash
vercel deploy --prod
```

Connecting the GitHub repo in the Vercel dashboard (**Settings → Git**) gives you
automatic deploys on push plus per-PR preview URLs. The CLI attempted this during setup
and failed, which usually means the Vercel GitHub app hasn't been granted access to the
repository yet.

## 5. Database changes

```bash
supabase db push          # apply supabase/migrations/ to the linked project
supabase migration list   # what's applied where
```

Migrations are append-only: never edit one that has been applied, add another. The DB
password is stored in your keychain by `supabase link`; regenerate it from
**Project Settings → Database** if you lose it.
