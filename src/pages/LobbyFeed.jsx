import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { useLobbyData } from '../hooks/useLobbyData'
import { useTicker } from '../hooks/useTicker'
import { acceptBet } from '../lib/rpc'
import { IconButton, TopBar } from '../components/TopBar'
import { icons } from '../components/icons'
import { BetCard } from '../components/BetCard'
import { CreateBetModal } from '../components/CreateBetModal'
import { ShareLobbyModal } from '../components/ShareLobbyModal'
import { Alert, Avatar, Button, EmptyState, Spinner } from '../components/ui'

const TABS = [
  { key: 'open', label: 'Open' },
  { key: 'mine', label: 'Mine' },
  { key: 'all', label: 'All' },
]

export default function LobbyFeed() {
  const { lobbyId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const { lobby, members, bets, loading, error, nameOf } = useLobbyData(lobbyId)

  // Keeps the "2 minutes ago" captions honest on a screen nobody touches.
  useTicker()
  const [tab, setTab] = useState('open')
  const [showCreate, setShowCreate] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [actionError, setActionError] = useState('')
  const [acceptingId, setAcceptingId] = useState(null)

  const isHost = lobby?.host_id === user?.id

  // A brand new lobby is empty and pointless alone, so ?welcome=1 (set right
  // after creating one) opens Share straight away. Reading it as derived state
  // rather than firing an effect keeps this a single render.
  const welcoming = searchParams.get('welcome') === '1'
  const shareOpen = showShare || (welcoming && Boolean(lobby))

  const closeShare = () => {
    setShowShare(false)
    if (welcoming) {
      const next = new URLSearchParams(searchParams)
      next.delete('welcome')
      setSearchParams(next, { replace: true })
    }
  }

  const visibleBets = useMemo(() => {
    if (tab === 'open') return bets.filter((bet) => bet.status === 'OPEN')
    if (tab === 'mine') {
      return bets.filter((bet) => bet.creator_id === user?.id || bet.acceptor_id === user?.id)
    }
    return bets
  }, [bets, tab, user?.id])

  const handleAccept = async (betId) => {
    setActionError('')
    setAcceptingId(betId)
    try {
      await acceptBet(betId)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setAcceptingId(null)
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
        <TopBar title="Lobby" backTo="/" />
        <div className="mx-auto max-w-md px-4 py-10">
          <Alert>{error || 'Lobby not found.'}</Alert>
          <Button variant="secondary" className="mt-4 w-full" onClick={() => navigate('/')}>
            Back to your lobbies
          </Button>
        </div>
      </div>
    )
  }

  const archived = lobby.status === 'ARCHIVED'

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar
        title={lobby.name}
        subtitle={`${members.length} ${members.length === 1 ? 'player' : 'players'} · ${lobby.code}`}
        backTo="/"
        actions={
          <>
            <IconButton label="Invite friends" onClick={() => setShowShare(true)}>
              {icons.share}
            </IconButton>
            <IconButton label="Big screen view" to={`/lobby/${lobbyId}/dashboard`}>
              {icons.tv}
            </IconButton>
            <IconButton
              label={isHost ? 'Manage lobby' : 'Lobby settings'}
              to={`/lobby/${lobbyId}/manage`}
            >
              {icons.settings}
            </IconButton>
          </>
        }
      />

      <div className="sticky top-14 z-20 border-b border-zinc-800 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-2xl">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`flex-1 border-b-2 py-3 text-sm font-semibold transition-colors ${
                tab === item.key
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {item.label}
              {item.key === 'open' && (
                <span className="ml-1.5 text-xs text-zinc-600">
                  {bets.filter((bet) => bet.status === 'OPEN').length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
          {members.map((member) => (
            <div key={member.user_id} className="flex shrink-0 items-center gap-1.5">
              <Avatar
                name={member.profiles?.display_name}
                url={member.profiles?.avatar_url}
                size="sm"
              />
              <span className="text-xs whitespace-nowrap text-zinc-500">
                {member.user_id === user?.id ? 'You' : member.profiles?.display_name}
              </span>
            </div>
          ))}
          <button
            onClick={() => setShowShare(true)}
            className="shrink-0 rounded-full border border-dashed border-zinc-700 px-3 py-1 text-xs text-zinc-500 hover:border-emerald-600 hover:text-emerald-400"
          >
            + Invite
          </button>
        </div>

        {actionError && (
          <div className="mb-4">
            <Alert>{actionError}</Alert>
          </div>
        )}

        {archived && (
          <div className="mb-4">
            <Alert tone="info">This lobby is archived. No new bets can be created.</Alert>
          </div>
        )}

        {visibleBets.length === 0 ? (
          <EmptyState
            title={
              tab === 'open'
                ? 'No open bets'
                : tab === 'mine'
                  ? "You haven't bet yet"
                  : 'Nothing here yet'
            }
            hint={
              tab === 'open'
                ? 'Post one and see who bites.'
                : 'Take someone up on an open bet, or post your own.'
            }
            action={
              !archived && (
                <Button onClick={() => setShowCreate(true)}>Post the first bet</Button>
              )
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {visibleBets.map((bet) => (
              <li key={bet.id}>
                <BetCard
                  bet={bet}
                  lobbyId={lobbyId}
                  currentUserId={user?.id}
                  nameOf={nameOf}
                  onAccept={handleAccept}
                  accepting={acceptingId === bet.id}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      {!archived && (
        <button
          onClick={() => setShowCreate(true)}
          aria-label="Create a bet"
          className="safe-bottom fixed right-5 bottom-0 z-20 mb-6 flex h-14 w-14 items-center justify-center
            rounded-full bg-emerald-500 text-3xl leading-none font-light text-emerald-950 shadow-lg
            shadow-emerald-500/20 transition-colors hover:bg-emerald-400"
        >
          +
        </button>
      )}

      {showCreate && <CreateBetModal lobbyId={lobbyId} onClose={() => setShowCreate(false)} />}
      {shareOpen && <ShareLobbyModal lobby={lobby} onClose={closeShare} />}
    </div>
  )
}
