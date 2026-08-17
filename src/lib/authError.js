/**
 * Captures an OAuth failure handed back in the redirect URL.
 *
 * When the round trip through Google fails — a mismatched client secret, a
 * revoked consent, a provider that got switched off — Supabase bounces the
 * browser back to the app with `error` / `error_description` in the query string
 * (PKCE) or the hash fragment (implicit). Nothing reads those by default, so the
 * guest just lands on the sign-in screen again with no idea why, which is
 * indistinguishable from "the button did nothing".
 *
 * Captured at module load, before the router or supabase-js can rewrite the URL,
 * and stripped immediately so a refresh doesn't resurrect a stale error.
 */
function capture() {
  if (typeof window === 'undefined') return ''

  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const pick = (key) => url.searchParams.get(key) || hash.get(key)

  const code = pick('error')
  if (!code) return ''

  const description = pick('error_description') || code
  const errorCode = pick('error_code')

  for (const key of ['error', 'error_description', 'error_code', 'state', 'provider']) {
    url.searchParams.delete(key)
  }
  url.hash = ''
  window.history.replaceState({}, '', url.pathname + url.search)

  // error_description arrives form-encoded.
  const readable = description.replace(/\+/g, ' ')
  return errorCode && !readable.includes(errorCode) ? `${readable} (${errorCode})` : readable
}

const captured = capture()

export function getOAuthRedirectError() {
  return captured
}
