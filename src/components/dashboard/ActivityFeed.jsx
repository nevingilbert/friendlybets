import { formatRelative } from '../../lib/format'
import { lastTouched } from '../../lib/bets'

const ACCENT = {
  OPEN: 'border-l-emerald-500',
  ACCEPTED: 'border-l-sky-500',
  RESOLVED: 'border-l-amber-500',
  COMPLETED: 'border-l-zinc-500',
  CANCELLED: 'border-l-zinc-700',
}

function truncate(text, max = 70) {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function describe(bet, nameOf) {
  const prop = <span className="text-zinc-400">“{truncate(bet.proposition)}”</span>
  const stake = <span className="font-semibold text-violet-300">{bet.stake}</span>

  switch (bet.status) {
    case 'ACCEPTED':
      return (
        <>
          <Name tone="sky">{nameOf(bet.acceptor_id)}</Name> took <Name>{nameOf(bet.creator_id)}</Name>
          &rsquo;s bet — {stake} on {prop}
        </>
      )
    case 'RESOLVED':
      return (
        <>
          <Name tone="emerald">{nameOf(bet.winner_id)}</Name> beat{' '}
          <Name tone="rose">{nameOf(bet.loser_id)}</Name> for {stake} on {prop}
        </>
      )
    case 'COMPLETED':
      return (
        <>
          <Name>{nameOf(bet.loser_id)}</Name> paid up — {stake} on {prop}
        </>
      )
    case 'CANCELLED':
      return (
        <>
          <Name>{nameOf(bet.creator_id)}</Name> pulled {prop}
        </>
      )
    default:
      return (
        <>
          <Name tone="emerald">{nameOf(bet.creator_id)}</Name> posted {stake} on {prop}
        </>
      )
  }
}

function Name({ children, tone = 'zinc' }) {
  const tones = {
    zinc: 'text-zinc-100',
    emerald: 'text-emerald-400',
    sky: 'text-sky-400',
    rose: 'text-rose-400',
  }
  return <span className={`font-semibold ${tones[tone]}`}>{children}</span>
}

export function ActivityFeed({ bets, nameOf }) {
  const items = bets.slice(0, 12)

  return (
    <div className="flex min-h-0 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <h2 className="mb-4 text-xl font-bold tracking-widest text-zinc-400 uppercase">Activity</h2>
      {items.length === 0 ? (
        <p className="py-8 text-center text-xl text-zinc-600">Nothing has happened yet</p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {items.map((bet) => (
            <li
              key={`${bet.id}-${bet.status}`}
              className={`animate-fade-up rounded-r-lg border-l-4 bg-zinc-800/40 px-4 py-3 ${
                ACCENT[bet.status] ?? ACCENT.OPEN
              }`}
            >
              <p className="text-lg leading-relaxed text-zinc-300">{describe(bet, nameOf)}</p>
              <p className="mt-0.5 text-xs text-zinc-600">{formatRelative(lastTouched(bet))}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
