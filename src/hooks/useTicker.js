import { useEffect, useState } from 'react'

/**
 * Re-renders the caller on an interval.
 *
 * Relative timestamps ("2 minutes ago") are computed during render from
 * Date.now(), so without something nudging React they freeze at whatever they
 * said when the component last rendered. That is invisible on a phone the user
 * keeps touching, but the big-screen dashboard can sit untouched for an hour
 * still claiming the last bet landed "just now".
 */
export function useTicker(intervalMs = 30_000) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}
