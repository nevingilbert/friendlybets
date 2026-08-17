import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { useLobbyData } from '../hooks/useLobbyData'
import {
  hostDeleteBet,
  hostUndoAccept,
  leaveLobby,
  removeMember,
  updateLobby,
} from '../lib/rpc'
import { formatRelative } from '../lib/format'
import { TopBar } from '../components/TopBar'
import {
  Alert,
  Avatar,
  Button,
  Card,
  Field,
  Input,
  Spinner,
  StatusPill,
} from '../components/ui'

const STATUS_CHOICES = [
  { value: 'OPEN', label: 'Open', hint: 'Anyone with the link can join.' },
  { value: 'LOCKED', label: 'Locked', hint: 'No new players, betting continues.' },
  { value: 'ARCHIVED', label: 'Archived', hint: 'Read-only. No new bets.' },
]

/**
 * Replaces the old `/admin-x7k9m2` page. That one was a secret URL with no
 * server-side check — anyone who found it could delete anyone's bets. Host-only
 * actions here are enforced in Postgres, so the UI is just a convenience.
 */
export default function LobbyManage() {
  const { lobbyId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lobby, members, bets, loading, error, nameOf } = useLobbyData(lobbyId)

  // null means "untouched" — the field shows the live lobby name until the host
  // actually types, which avoids syncing state from props in an effect.
  const [draftName, setDraftName] = useState(null)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)

  const name = draftName ?? lobby?.name ?? ''

  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(() => setMessage(''), 3000)
    return () => clearTimeout(timer)
  }, [message])

  const run = async (fn, successMessage) => {
    setBusy(true)
    setActionError('')
    try {
      await fn()
      if (successMessage) setMessage(successMessage)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Spinner />
      </div>
    )
  }

  if (error || !lobby) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <TopBar title="Lobby settings" backTo="/" />
        <div className="mx-auto max-w-md px-4 py-10">
          <Alert>{error || 'Lobby not found.'}</Alert>
        </div>
      </div>
    )
  }

  const isHost = lobby.host_id === user?.id

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar title="Lobby settings" subtitle={lobby.name} backTo={`/lobby/${lobbyId}`} />

      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-5">
        <Alert>{actionError}</Alert>
        {message && <Alert tone="success">{message}</Alert>}

        {isHost && (
          <>
            <Card className="p-5">
              <h2 className="mb-4 font-semibold text-zinc-100">Lobby name</h2>
              <div className="flex gap-2">
                <Field label="">
                  <Input
                    value={name}
                    maxLength={60}
                    onChange={(event) => setDraftName(event.target.value)}
                  />
                </Field>
                <Button
                  className="mt-0 self-start"
                  disabled={busy || !name.trim() || name === lobby.name}
                  onClick={() =>
                    run(async () => {
                      await updateLobby(lobbyId, { name: name.trim() })
                      setDraftName(null)
                    }, 'Renamed.')
                  }
                >
                  Save
                </Button>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-1 font-semibold text-zinc-100">Who can join</h2>
              <p className="mb-4 text-sm text-zinc-500">
                Join code <span className="font-mono text-emerald-400">{lobby.code}</span>
              </p>
              <div className="flex flex-col gap-2">
                {STATUS_CHOICES.map((choice) => {
                  const selected = lobby.status === choice.value
                  return (
                    <button
                      key={choice.value}
                      disabled={busy || selected}
                      onClick={() =>
                        run(
                          () => updateLobby(lobbyId, { status: choice.value }),
                          `Lobby is now ${choice.label.toLowerCase()}.`,
                        )
                      }
                      className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                        selected
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <p className="text-sm font-semibold text-zinc-100">{choice.label}</p>
                      <p className="text-xs text-zinc-500">{choice.hint}</p>
                    </button>
                  )
                })}
              </div>
            </Card>
          </>
        )}

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-zinc-100">
            Players <span className="text-zinc-600">({members.length})</span>
          </h2>
          <ul className="flex flex-col divide-y divide-zinc-800">
            {members.map((member) => (
              <li key={member.user_id} className="flex items-center gap-3 py-3">
                <Avatar
                  name={member.profiles?.display_name}
                  url={member.profiles?.avatar_url}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {member.profiles?.display_name}
                    {member.user_id === user?.id && (
                      <span className="ml-1.5 text-xs text-zinc-500">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {member.role === 'HOST' ? 'Host' : 'Player'} · joined{' '}
                    {formatRelative(member.joined_at)}
                  </p>
                </div>
                {isHost && member.role !== 'HOST' && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    className="text-rose-400 hover:bg-rose-500/10"
                    onClick={() =>
                      run(
                        () => removeMember(lobbyId, member.user_id),
                        `Removed ${member.profiles?.display_name}.`,
                      )
                    }
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>

        {isHost && (
          <Card className="p-5">
            <h2 className="mb-1 font-semibold text-zinc-100">Moderate bets</h2>
            <p className="mb-4 text-sm text-zinc-500">
              Reopen a bet someone took by mistake, or delete one entirely.
            </p>
            {bets.length === 0 ? (
              <p className="py-4 text-sm text-zinc-600">No bets yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-800">
                {bets.map((bet) => (
                  <li key={bet.id} className="flex flex-col gap-2.5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 text-sm text-zinc-200">{bet.proposition}</p>
                      <StatusPill status={bet.status} />
                    </div>
                    <p className="text-xs text-zinc-600">
                      {bet.stake} · {nameOf(bet.creator_id)} ({bet.creator_side})
                      {bet.acceptor_id && ` vs ${nameOf(bet.acceptor_id)}`}
                    </p>
                    <div className="flex gap-2">
                      {bet.status === 'ACCEPTED' && (
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => run(() => hostUndoAccept(bet.id), 'Bet reopened.')}
                        >
                          Undo accept
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        disabled={busy}
                        className="text-rose-400 hover:bg-rose-500/10"
                        onClick={() => run(() => hostDeleteBet(bet.id), 'Bet deleted.')}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {!isHost && (
          <Card className="p-5">
            <h2 className="mb-1 font-semibold text-zinc-100">Leave this lobby</h2>
            <p className="mb-4 text-sm text-zinc-500">
              Your bets stay on the board. You can rejoin with the code any time.
            </p>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await leaveLobby(lobbyId)
                  navigate('/', { replace: true })
                })
              }
            >
              Leave lobby
            </Button>
          </Card>
        )}
      </main>
    </div>
  )
}
