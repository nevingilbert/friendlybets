import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { createLobby, fetchMyLobbies, joinLobby } from '../lib/rpc'
import { formatRelative } from '../lib/format'
import { TopBar } from '../components/TopBar'
import { Alert, Button, Card, EmptyState, Field, Input, Modal, Spinner } from '../components/ui'

export default function Lobbies() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [lobbies, setLobbies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await fetchMyLobbies()
        if (!cancelled) {
          setLobbies(rows)
          setError('')
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar title="FriendlyBets" subtitle={profile ? `Signed in as ${profile.display_name}` : null} />

      <main className="mx-auto max-w-2xl px-4 pt-6 pb-28">
        <div className="mb-6 grid grid-cols-2 gap-3">
          <Button onClick={() => setShowCreate(true)}>Create a lobby</Button>
          <Button variant="secondary" onClick={() => setShowJoin(true)}>
            Join with a code
          </Button>
        </div>

        <Alert>{error}</Alert>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : lobbies.length === 0 ? (
          <EmptyState
            title="No lobbies yet"
            hint="Create one and send the link to your friends, or join theirs with a six-character code."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {lobbies.map((lobby) => (
              <li key={lobby.id}>
                <Link to={`/lobby/${lobby.id}`} className="block">
                  <Card className="animate-fade-up p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-zinc-100">{lobby.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {lobby.member_count} {lobby.member_count === 1 ? 'player' : 'players'} ·
                          created {formatRelative(lobby.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="rounded-md bg-zinc-800 px-2 py-1 font-mono text-xs tracking-widest text-emerald-300">
                          {lobby.code}
                        </span>
                        {lobby.host_id === profile?.id && (
                          <span className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
                            Host
                          </span>
                        )}
                      </div>
                    </div>
                    {lobby.status !== 'OPEN' && (
                      <p className="mt-3 text-xs text-amber-400/80">
                        {lobby.status === 'LOCKED'
                          ? 'Closed to new players'
                          : 'Archived — no new bets'}
                      </p>
                    )}
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      {showCreate && (
        <CreateLobbyModal
          onClose={() => setShowCreate(false)}
          onCreated={(lobby) => navigate(`/lobby/${lobby.id}?welcome=1`)}
        />
      )}
      {showJoin && (
        <JoinByCodeModal
          onClose={() => setShowJoin(false)}
          onJoined={(lobby) => navigate(`/lobby/${lobby.id}`)}
        />
      )}
    </div>
  )
}

function CreateLobbyModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Give your lobby a name.')
      return
    }
    setBusy(true)
    setError('')
    try {
      onCreated(await createLobby(name.trim()))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Create a lobby" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Lobby name" hint="Whatever you'd call the group chat.">
          <Input
            autoFocus
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder="Super Bowl at Nevin's"
          />
        </Field>
        <Alert>{error}</Alert>
        <Button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create lobby'}
        </Button>
      </form>
    </Modal>
  )
}

function JoinByCodeModal({ onClose, onJoined }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (code.trim().length !== 6) {
      setError('Codes are six characters.')
      return
    }
    setBusy(true)
    setError('')
    try {
      onJoined(await joinLobby(code.trim()))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Join a lobby" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Six-character code" hint="Ask the host, or open the link they sent you.">
          <Input
            autoFocus
            value={code}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="XK4P2M"
            className="text-center font-mono text-2xl tracking-[0.4em]"
          />
        </Field>
        <Alert>{error}</Alert>
        <Button type="submit" disabled={busy}>
          {busy ? 'Joining…' : 'Join lobby'}
        </Button>
      </form>
    </Modal>
  )
}
