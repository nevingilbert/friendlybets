import { useState } from 'react'
import { useAuth } from '../context/auth'
import { Alert, GoogleButton } from '../components/ui'

const HIGHLIGHTS = [
  ['Start a lobby', 'One tap. You get a six-character code and a link.'],
  ['Share the link', 'Friends join from their phone — no install, no account setup.'],
  ['Bet on anything', 'Freeform stakes. A shot, the dishes, bragging rights.'],
]

export default function SignInGate({ headline, subhead }) {
  const { signInWithGoogle } = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSignIn = async () => {
    setError('')
    setBusy(true)
    try {
      await signInWithGoogle(window.location.href)
      // The browser navigates to Google here; `busy` stays true on purpose.
    } catch (err) {
      const message = /provider is not enabled|unsupported provider/i.test(err.message)
        ? 'Google sign-in has not been switched on for this project yet. See docs/DEPLOYMENT.md.'
        : err.message
      setError(message)
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-10 px-6 py-16">
      <header className="animate-fade-up">
        <p className="mb-3 text-sm font-semibold tracking-widest text-emerald-400 uppercase">
          FriendlyBets
        </p>
        <h1 className="text-4xl leading-tight font-extrabold text-balance text-zinc-50">
          {headline ?? 'Bet your friends on anything.'}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-400">
          {subhead ??
            'Create a lobby, send the link, and settle it on the honour system. Nothing to install.'}
        </p>
      </header>

      <ul className="animate-fade-up flex flex-col gap-4">
        {HIGHLIGHTS.map(([title, body], index) => (
          <li key={title} className="flex gap-3.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-300">
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-200">{title}</p>
              <p className="text-sm text-zinc-500">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3">
        <Alert>{error}</Alert>
        <GoogleButton onClick={handleSignIn} disabled={busy}>
          {busy ? 'Redirecting…' : 'Continue with Google'}
        </GoogleButton>
        <p className="text-center text-xs text-zinc-600">
          We only ever read your name and profile picture.
        </p>
      </div>
    </main>
  )
}
