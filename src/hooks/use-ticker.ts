"use client";

import { useEffect, useState } from "react";

/**
 * Re-renders the caller on an interval and returns the current time.
 *
 * Relative timestamps ("2 minutes ago") would otherwise freeze at whatever they said
 * on the last render — invisible on a phone someone keeps touching, but the TV can sit
 * untouched for an hour still claiming the last bet landed "just now".
 */
export function useTicker(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
