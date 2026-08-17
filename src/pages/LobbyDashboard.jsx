import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLobbyData } from '../hooks/useLobbyData'
import { useTicker } from '../hooks/useTicker'
import { StatsBar } from '../components/dashboard/StatsBar'
import { OpenBetsTicker } from '../components/dashboard/OpenBetsTicker'
import { ActivityFeed } from '../components/dashboard/ActivityFeed'
import { Leaderboard } from '../components/dashboard/Leaderboard'
import { QrCode } from '../components/QrCode'
import { inviteUrlFor } from '../lib/invite'
import { lastTouched } from '../lib/bets'
import { Alert, Spinner } from '../components/ui'

/**
 * The "put it on the TV" view. Deliberately read-only and large: everything
 * here has to be legible from across a room, and it updates over Realtime so
 * nobody ever needs to touch the laptop.
 */
export default function LobbyDashboard() {
  const { lobbyId } = useParams()
  const { lobby, members, bets, leaderboard, loading, error, nameOf } = useLobbyData(lobbyId)

  // Keeps the "2 minutes ago" captions honest on a screen nobody touches.
  useTicker()

  const openBets = useMemo(() => bets.filter((bet) => bet.status === 'OPEN'), [bets])

  const activity = useMemo(
    () =>
      [...bets].sort((a, b) => new Date(lastTouched(b)) - new Date(lastTouched(a))),
    [bets],
  )

  const stats = useMemo(
    () => ({
      open: openBets.length,
      active: bets.filter((bet) => bet.status === 'ACCEPTED').length,
      owed: bets.filter((bet) => bet.status === 'RESOLVED').length,
      players: members.length,
    }),
    [bets, openBets.length, members.length],
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Spinner />
      </div>
    )
  }

  if (error || !lobby) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Alert>{error || 'Lobby not found.'}</Alert>
        <Link to="/" className="mt-4 inline-block text-sm text-emerald-400 underline">
          Back to your lobbies
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col gap-5 bg-zinc-950 p-6">
      <header className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-[0.3em] text-emerald-500 uppercase">
            FriendlyBets
          </p>
          <h1 className="truncate text-4xl font-extrabold text-zinc-50">{lobby.name}</h1>
        </div>
        <Link
          to={`/lobby/${lobbyId}`}
          className="shrink-0 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:text-zinc-300"
        >
          Exit big screen
        </Link>
      </header>

      <StatsBar stats={stats} />

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-5">
        <div className="col-span-2 flex min-h-0 flex-col gap-5">
          <OpenBetsTicker bets={openBets} nameOf={nameOf} />
          <div className="min-h-0 flex-1">
            <ActivityFeed bets={activity} nameOf={nameOf} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-5">
          <div className="min-h-0 flex-1">
            <Leaderboard rows={leaderboard} />
          </div>

          <div className="flex shrink-0 items-center gap-5 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <QrCode value={inviteUrlFor(lobby.code)} size={132} className="p-2" />
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-widest text-zinc-500 uppercase">
                Scan to join
              </p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-[0.2em] text-emerald-400">
                {lobby.code}
              </p>
              <p className="mt-1 truncate text-xs text-zinc-600">
                {inviteUrlFor(lobby.code).replace(/^https?:\/\//, '')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
