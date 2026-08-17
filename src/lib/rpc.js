import { supabase } from './supabase'

/**
 * Every mutation in this app is a SECURITY DEFINER function in Postgres, so the
 * messages raised there are already written for humans. This just surfaces them
 * and keeps Postgres jargon out of the UI.
 */
function unwrap({ data, error }) {
  if (error) {
    const message = error.message || 'Something went wrong.'
    if (/JWT|not authenticated|invalid claim/i.test(message)) {
      throw new Error('Your session expired — sign in again.')
    }
    if (/violates row-level security|permission denied/i.test(message)) {
      throw new Error('You do not have access to that.')
    }
    throw new Error(message)
  }
  return data
}

// --- lobbies ---------------------------------------------------------------

export async function createLobby(name) {
  return unwrap(await supabase.rpc('create_lobby', { p_name: name }))
}

/** Works signed-out so an invite link can show what you were invited to. */
export async function previewLobby(code) {
  return unwrap(await supabase.rpc('lobby_preview', { p_code: code }).maybeSingle())
}

export async function joinLobby(code) {
  return unwrap(await supabase.rpc('join_lobby', { p_code: code }))
}

export async function leaveLobby(lobbyId) {
  return unwrap(await supabase.rpc('leave_lobby', { p_lobby_id: lobbyId }))
}

export async function updateLobby(lobbyId, { name = null, status = null } = {}) {
  return unwrap(
    await supabase.rpc('update_lobby', {
      p_lobby_id: lobbyId,
      p_name: name,
      p_status: status,
    }),
  )
}

export async function removeMember(lobbyId, userId) {
  return unwrap(
    await supabase.rpc('remove_member', { p_lobby_id: lobbyId, p_user_id: userId }),
  )
}

export async function fetchMyLobbies() {
  // RLS already limits this to lobbies you belong to.
  const lobbies = unwrap(
    await supabase.from('lobbies').select('*').order('created_at', { ascending: false }),
  )
  if (!lobbies?.length) return []

  const members = unwrap(
    await supabase
      .from('lobby_members')
      .select('lobby_id, user_id')
      .in('lobby_id', lobbies.map((l) => l.id)),
  )

  const counts = new Map()
  for (const row of members ?? []) {
    counts.set(row.lobby_id, (counts.get(row.lobby_id) ?? 0) + 1)
  }
  return lobbies.map((lobby) => ({ ...lobby, member_count: counts.get(lobby.id) ?? 0 }))
}

export async function fetchLobby(lobbyId) {
  return unwrap(await supabase.from('lobbies').select('*').eq('id', lobbyId).maybeSingle())
}

export async function fetchMembers(lobbyId) {
  return unwrap(
    await supabase
      .from('lobby_members')
      .select('user_id, role, joined_at, profiles(display_name, avatar_url)')
      .eq('lobby_id', lobbyId)
      .order('joined_at', { ascending: true }),
  )
}

export async function fetchLeaderboard(lobbyId) {
  return unwrap(await supabase.rpc('lobby_leaderboard', { p_lobby_id: lobbyId }))
}

// --- bets ------------------------------------------------------------------

export async function fetchBets(lobbyId) {
  return unwrap(
    await supabase
      .from('bets')
      .select('*')
      .eq('lobby_id', lobbyId)
      .order('created_at', { ascending: false }),
  )
}

export async function fetchBet(betId) {
  return unwrap(await supabase.from('bets').select('*').eq('id', betId).maybeSingle())
}

export async function createBet(lobbyId, { proposition, stake, side }) {
  return unwrap(
    await supabase.rpc('create_bet', {
      p_lobby_id: lobbyId,
      p_proposition: proposition,
      p_stake: stake,
      p_creator_side: side,
    }),
  )
}

export const acceptBet = (betId) => rpcOnBet('accept_bet', betId)
export const cancelBet = (betId) => rpcOnBet('cancel_bet', betId)
export const completeBet = (betId) => rpcOnBet('complete_bet', betId)
export const hostUndoAccept = (betId) => rpcOnBet('host_undo_accept', betId)
export const hostDeleteBet = (betId) => rpcOnBet('host_delete_bet', betId)

async function rpcOnBet(fn, betId) {
  return unwrap(await supabase.rpc(fn, { p_bet_id: betId }))
}

export async function resolveBet(betId, outcome) {
  return unwrap(await supabase.rpc('resolve_bet', { p_bet_id: betId, p_outcome: outcome }))
}

// --- profile ---------------------------------------------------------------

export async function fetchProfile(userId) {
  return unwrap(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle())
}

export async function renameSelf(userId, displayName) {
  return unwrap(
    await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', userId)
      .select()
      .maybeSingle(),
  )
}
