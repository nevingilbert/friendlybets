/**
 * The invite link a guest opens to join a lobby.
 *
 * Built from window.location.origin so the same code works on localhost, on a
 * Vercel preview deployment, and in production without any configuration.
 */
export function inviteUrlFor(code) {
  return `${window.location.origin}/join/${code}`
}
