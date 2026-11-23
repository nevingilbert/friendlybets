import type { Bet, Side } from "@/lib/types";

/** Accepting a bet always means taking the side the creator didn't. */
export function oppositeOf(side: Side): Side {
  return side === "YES" ? "NO" : "YES";
}

/** The most recent thing that happened to a bet — used to order the activity feed. */
export function lastTouched(bet: Bet): string {
  return bet.completed_at || bet.resolved_at || bet.accepted_at || bet.created_at;
}
