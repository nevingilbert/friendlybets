const CARDS = [
  { key: 'open', label: 'Open', className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' },
  { key: 'active', label: 'Locked in', className: 'border-sky-500/25 bg-sky-500/10 text-sky-400' },
  { key: 'owed', label: 'Unpaid', className: 'border-amber-500/25 bg-amber-500/10 text-amber-400' },
  { key: 'players', label: 'Players', className: 'border-violet-500/25 bg-violet-500/10 text-violet-400' },
]

export function StatsBar({ stats }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {CARDS.map((card) => (
        <div
          key={card.key}
          className={`flex flex-col items-center justify-center rounded-2xl border py-5 ${card.className}`}
        >
          <span className="text-xs font-semibold tracking-[0.2em] text-zinc-400 uppercase">
            {card.label}
          </span>
          <span className="mt-1 text-5xl font-extrabold tabular-nums">{stats[card.key] ?? 0}</span>
        </div>
      ))}
    </div>
  )
}
