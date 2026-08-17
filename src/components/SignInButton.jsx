import { useState } from 'react'
import { useAuth } from '../context/auth'
import { getOAuthRedirectError } from '../lib/authError'
import { Alert, GoogleButton } from './ui'

/**
 * Google sign-in with its failure modes handled, shared by the landing page and
 * the invite page so both report problems the same way.
 *
 * `redirectTo` defaults to the current URL, which is what lets an invite link
 * survive the round trip through Google and land back on /join/<CODE>.
 */
export function SignInButton({ label = 'Continue with Google', redirectTo }) {
  const { signInWithGoogle } = useAuth()
  // A failure from a previous redirect back into the app, if there was one.
  const [error, setError] = useState(getOAuthRedirectError)
  const [busy, setBusy] = useState(false)

  const handleClick = async () => {
    setError('')
    setBusy(true)
    try {
      await signInWithGoogle(redirectTo || window.location.href)
      // On success the browser navigates away to Google, so `busy` stays true.
    } catch (err) {
      setError(
        /provider is not enabled|unsupported provider/i.test(err.message)
          ? 'Google sign-in has not been switched on for this project yet. See docs/DEPLOYMENT.md.'
          : err.message,
      )
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Alert>{error}</Alert>
      <GoogleButton onClick={handleClick} disabled={busy}>
        {busy ? 'Redirecting…' : label}
      </GoogleButton>
      <p className="text-center text-xs text-zinc-600">
        We only ever read your name and profile picture.
      </p>
    </div>
  )
}
