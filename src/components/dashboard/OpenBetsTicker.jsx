import { useEffect, useState } from 'react'
import { oppositeOf } from '../../lib/bets'

/** Rotates through open bets so the room keeps seeing what needs a taker. */
export function OpenBetsTicker({ bets, nameOf }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (bets.length <= 1) return undefined
    const timer = setInterval(() => setIndex((prev) => prev + 1), 5000)
    return () => clearInterval(timer)
  }, [bets.length])

  if (bets.length === 0) {
    return (
      <div className="flex min-h-52 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8">
        <p className="text-center text-2xl text-zinc-500">
          No open bets — post one from your phone
        </p>
      </div>
    )
  }

  // Wrapping here rather than resetting the counter in an effect means a bet
  // being taken can shrink the list without leaving the index out of range.
  const position = index % bets.length
  const bet = bets[position]

  return (
    <div className="relative min-h-52 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-violet-500" />

      <div key={bet.id} className="animate-fade-up">
        <p className="text-4xl leading-tight font-bold text-balance text-zinc-50">
          {bet.proposition}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <span className="rounded-full border border-violet-500/30 bg-violet-500/15 px-5 py-2 text-2xl font-bold text-violet-300">
            {bet.stake}
          </span>
          <p className="text-xl text-zinc-400">
            <span className="font-semibold text-zinc-100">{nameOf(bet.creator_id)}</span> says{' '}
            <span
              className={
                bet.creator_side === 'YES'
                  ? 'font-bold text-emerald-400'
                  : 'font-bold text-rose-400'
              }
            >
              {bet.creator_side}
            </span>
            {' — needs someone on '}
            <span className="font-bold text-zinc-200">{oppositeOf(bet.creator_side)}</span>
          </p>
        </div>
      </div>

      {bets.length > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {bets.map((item, i) => (
            <span
              key={item.id}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === position ? 'bg-zinc-200' : 'bg-zinc-700'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
