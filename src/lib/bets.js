/** Accepting a bet always means taking the side the creator didn't. */
export function oppositeOf(side) {
  return side === 'YES' ? 'NO' : 'YES'
}

/** The most recent thing that happened to a bet — used to order the activity feed. */
export function lastTouched(bet) {
  return bet.completed_at || bet.resolved_at || bet.accepted_at || bet.created_at
}
