import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { useLobbyData } from '../hooks/useLobbyData'
import { acceptBet, cancelBet, completeBet, resolveBet } from '../lib/rpc'
import { formatDateTime } from '../lib/format'
import { TopBar } from '../components/TopBar'
import { oppositeOf } from '../lib/bets'
import { Alert, Avatar, Button, Card, SidePill, Spinner, StatusPill } from '../components/ui'

export default function BetDetail() {
  const { lobbyId, betId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lobby, memberMap, bets, loading, error, nameOf } = useLobbyData(lobbyId)

  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const bet = useMemo(() => bets.find((row) => row.id === betId), [bets, betId])

  const run = async (fn) => {
    setBusy(true)
    setActionError('')
    try {
      await fn()
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

  if (error || !bet) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <TopBar title="Bet" backTo={`/lobby/${lobbyId}`} />
        <div className="mx-auto max-w-md px-4 py-10">
          <Alert>{error || 'This bet no longer exists — the host may have removed it.'}</Alert>
          <Button
            variant="secondary"
            className="mt-4 w-full"
            onClick={() => navigate(`/lobby/${lobbyId}`)}
          >
            Back to the lobby
          </Button>
        </div>
      </div>
    )
  }

  const isCreator = bet.creator_id === user?.id
  const isAcceptor = bet.acceptor_id === user?.id
  const isParticipant = isCreator || isAcceptor
  const acceptorSide = oppositeOf(bet.creator_side)

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar title={lobby?.name ?? 'Bet'} subtitle="Bet details" backTo={`/lobby/${lobbyId}`} />

      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-5">
        <Card className="animate-fade-up p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <StatusPill status={bet.status} />
            <span className="text-xs text-zinc-600">{formatDateTime(bet.created_at)}</span>
          </div>

          <h1 className="text-2xl leading-snug font-bold text-balance text-zinc-50">
            {bet.proposition}
          </h1>

          <div className="mt-5 rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-center">
            <p className="text-xs font-medium tracking-widest text-violet-400 uppercase">
              On the line
            </p>
            <p className="mt-1 text-2xl font-extrabold text-violet-200">{bet.stake}</p>
          </div>

          <div className="mt-5 flex flex-col gap-2.5">
            <SideRow
              label="Created by"
              person={memberMap.get(bet.creator_id)}
              fallbackName={nameOf(bet.creator_id)}
              side={bet.creator_side}
              isYou={isCreator}
            />
            {bet.acceptor_id ? (
              <SideRow
                label="Taken by"
                person={memberMap.get(bet.acceptor_id)}
                fallbackName={nameOf(bet.acceptor_id)}
                side={acceptorSide}
                isYou={isAcceptor}
              />
            ) : (
              bet.status === 'OPEN' && (
                <div className="rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-center text-sm text-zinc-500">
                  Nobody has taken <SidePill side={acceptorSide} /> yet
                </div>
              )
            )}
          </div>

          {bet.outcome && (
            <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
              <p className="text-sm text-amber-200">
                Outcome: <strong>{bet.outcome}</strong>
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                <span className="font-semibold text-emerald-400">{nameOf(bet.winner_id)}</span> won ·{' '}
                <span className="font-semibold text-rose-400">{nameOf(bet.loser_id)}</span>{' '}
                {bet.status === 'COMPLETED' ? 'has paid up' : `owes ${bet.stake}`}
              </p>
            </div>
          )}

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-zinc-800 pt-4 text-xs text-zinc-600">
            <Timestamp label="Created" value={bet.created_at} />
            <Timestamp label="Taken" value={bet.accepted_at} />
            <Timestamp label="Resolved" value={bet.resolved_at} />
            <Timestamp label="Settled" value={bet.completed_at} />
          </dl>
        </Card>

        <Alert>{actionError}</Alert>

        {bet.status === 'OPEN' && !isCreator && (
          <Button disabled={busy} onClick={() => run(() => acceptBet(bet.id))}>
            {busy ? 'Taking it…' : `Take ${acceptorSide} — ${bet.stake}`}
          </Button>
        )}

        {bet.status === 'OPEN' && isCreator && (
          <Button variant="secondary" disabled={busy} onClick={() => run(() => cancelBet(bet.id))}>
            {busy ? 'Cancelling…' : 'Cancel this bet'}
          </Button>
        )}

        {bet.status === 'ACCEPTED' && isParticipant && (
          <div className="flex flex-col gap-2">
            <p className="text-center text-sm text-zinc-500">What actually happened?</p>
            <div className="grid grid-cols-2 gap-3">
              <Button disabled={busy} onClick={() => run(() => resolveBet(bet.id, 'YES'))}>
                YES happened
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => run(() => resolveBet(bet.id, 'NO'))}
              >
                NO happened
              </Button>
            </div>
            <p className="text-center text-xs text-zinc-600">
              Either of you can call it. First call stands — honour system.
            </p>
          </div>
        )}

        {bet.status === 'RESOLVED' && isParticipant && (
          <Button variant="secondary" disabled={busy} onClick={() => run(() => completeBet(bet.id))}>
            {busy ? 'Saving…' : 'Mark the stake as paid'}
          </Button>
        )}
      </main>
    </div>
  )
}

function SideRow({ label, person, fallbackName, side, isYou }) {
  const name = person?.name ?? fallbackName
  return (
    <div className="flex items-center gap-3 rounded-xl bg-zinc-950/60 px-4 py-3">
      <Avatar name={name} url={person?.avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="truncate font-semibold text-zinc-100">{isYou ? 'You' : name}</p>
      </div>
      <SidePill side={side} />
    </div>
  )
}

function Timestamp({ label, value }) {
  if (!value) return null
  return (
    <>
      <dt className="text-zinc-600">{label}</dt>
      <dd className="text-right text-zinc-500">{formatDateTime(value)}</dd>
    </>
  )
}
