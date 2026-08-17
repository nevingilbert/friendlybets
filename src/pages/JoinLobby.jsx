import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { joinLobby, previewLobby } from '../lib/rpc'
import { Alert, Button, Card, GoogleButton, Spinner } from '../components/ui'

/**
 * Landing page for an invite link (/join/XK4P2M).
 *
 * Readable signed-out — `lobby_preview` is the one rpc granted to anon — so the
 * invitee sees who invited them *before* being asked to sign in. Google returns
 * them to this exact URL, at which point the join happens automatically.
 */
export default function JoinLobby() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading, signInWithGoogle } = useAuth()

  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | joining | error
  const [error, setError] = useState('')
  const joinAttempted = useRef(false)

  const normalisedCode = (code ?? '').trim().toUpperCase()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const row = await previewLobby(normalisedCode)
        if (cancelled) return
        if (!row) {
          setError(`No lobby has the code ${normalisedCode}. Double-check the link.`)
          setStatus('error')
          return
        }
        setPreview(row)
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        setError(err.message)
        setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [normalisedCode])

  // Once signed in and the lobby resolves, join without another tap.
  useEffect(() => {
    if (authLoading || !user || status !== 'ready' || joinAttempted.current) return
    joinAttempted.current = true
    setStatus('joining')
    ;(async () => {
      try {
        const lobby = await joinLobby(normalisedCode)
        navigate(`/lobby/${lobby.id}`, { replace: true })
      } catch (err) {
        setError(err.message)
        setStatus('error')
      }
    })()
  }, [authLoading, user, status, normalisedCode, navigate])

  if (status === 'loading' || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Spinner />
      </div>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-16">
      {status === 'error' ? (
        <>
          <h1 className="text-2xl font-bold text-zinc-100">That invite didn&apos;t work</h1>
          <Alert>{error}</Alert>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Go to FriendlyBets
          </Button>
        </>
      ) : (
        <>
          <div className="animate-fade-up text-center">
            <p className="mb-2 text-sm font-semibold tracking-widest text-emerald-400 uppercase">
              You&apos;re invited
            </p>
            <p className="text-zinc-400">
              <span className="font-semibold text-zinc-200">{preview.host_name}</span> invited you to
            </p>
            <h1 className="mt-2 text-3xl leading-tight font-extrabold text-balance text-zinc-50">
              {preview.name}
            </h1>
          </div>

          <Card className="animate-fade-up flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-xs tracking-wide text-zinc-500 uppercase">Join code</p>
              <p className="font-mono text-xl tracking-[0.3em] text-emerald-300">{preview.code}</p>
            </div>
            <div className="text-right">
              <p className="text-xs tracking-wide text-zinc-500 uppercase">Players</p>
              <p className="text-xl font-bold text-zinc-100">{preview.member_count}</p>
            </div>
          </Card>

          {preview.status !== 'OPEN' ? (
            <Alert tone="info">
              This lobby is closed to new players. Ask {preview.host_name} to reopen it.
            </Alert>
          ) : status === 'joining' ? (
            <div className="flex items-center justify-center gap-3 text-sm text-zinc-400">
              <Spinner className="h-5 w-5" /> Joining…
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <GoogleButton onClick={() => signInWithGoogle(window.location.href)}>
                Sign in with Google to join
              </GoogleButton>
              <p className="text-center text-xs text-zinc-600">
                We only ever read your name and profile picture.
              </p>
            </div>
          )}
        </>
      )}
    </main>
  )
}
