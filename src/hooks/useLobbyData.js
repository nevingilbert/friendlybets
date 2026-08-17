import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchBets, fetchLeaderboard, fetchLobby, fetchMembers } from '../lib/rpc'

/**
 * Loads a lobby and keeps it live.
 *
 * This is the Supabase Realtime replacement for the old Socket.IO server: we
 * subscribe to Postgres changes scoped to one lobby_id, so a phone and the
 * dashboard on the TV stay in sync without any server of our own. Bet rows
 * arrive as raw columns, so names are resolved locally against the roster —
 * that way a realtime row and a fetched row render identically.
 */
export function useLobbyData(lobbyId) {
  const [lobby, setLobby] = useState(null)
  const [members, setMembers] = useState([])
  const [bets, setBets] = useState([])
  const [leaderboard, setLeaderboard] = useState([])

  // Both of these are tagged with the lobby they describe, so `loading` and
  // `error` can be derived rather than reset synchronously inside an effect.
  const [loadedFor, setLoadedFor] = useState(null)
  const [failure, setFailure] = useState(null)
  const alive = useRef(true)

  const loading = loadedFor !== lobbyId && failure?.lobbyId !== lobbyId
  const error = failure?.lobbyId === lobbyId ? failure.message : ''

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const reloadMembers = useCallback(async () => {
    const rows = await fetchMembers(lobbyId).catch(() => null)
    if (rows && alive.current) setMembers(rows)
  }, [lobbyId])

  const reloadLeaderboard = useCallback(async () => {
    const rows = await fetchLeaderboard(lobbyId).catch(() => null)
    if (rows && alive.current) setLeaderboard(rows)
  }, [lobbyId])

  // Initial load
  useEffect(() => {
    if (!lobbyId) return undefined
    let cancelled = false

    ;(async () => {
      try {
        const [lobbyRow, memberRows, betRows, boardRows] = await Promise.all([
          fetchLobby(lobbyId),
          fetchMembers(lobbyId),
          fetchBets(lobbyId),
          fetchLeaderboard(lobbyId),
        ])
        if (cancelled) return

        if (!lobbyRow) {
          // RLS hides lobbies you are not in, so "no row" and "no access" are
          // the same observable state.
          setFailure({
            lobbyId,
            message: 'This lobby does not exist, or you have not joined it yet.',
          })
          return
        }

        setLobby(lobbyRow)
        setMembers(memberRows ?? [])
        setBets(betRows ?? [])
        setLeaderboard(boardRows ?? [])
        setFailure(null)
        setLoadedFor(lobbyId)
      } catch (err) {
        if (!cancelled) {
          setFailure({ lobbyId, message: err.message || 'Could not load this lobby.' })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [lobbyId])

  // Realtime
  useEffect(() => {
    if (!lobbyId) return undefined

    let boardTimer = null
    const scheduleBoardRefresh = () => {
      clearTimeout(boardTimer)
      // Bursts of accepts shouldn't each trigger their own round trip.
      boardTimer = setTimeout(reloadLeaderboard, 400)
    }

    const channel = supabase
      .channel(`lobby:${lobbyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bets', filter: `lobby_id=eq.${lobbyId}` },
        (payload) => {
          setBets((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((bet) => bet.id !== payload.old.id)
            }
            const row = payload.new
            const index = prev.findIndex((bet) => bet.id === row.id)
            if (index === -1) return [row, ...prev]
            const next = [...prev]
            next[index] = row
            return next
          })
          scheduleBoardRefresh()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lobby_members', filter: `lobby_id=eq.${lobbyId}` },
        () => {
          reloadMembers()
          scheduleBoardRefresh()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
        (payload) => {
          if (payload.eventType !== 'DELETE') setLobby(payload.new)
        },
      )
      .subscribe()

    return () => {
      clearTimeout(boardTimer)
      supabase.removeChannel(channel)
    }
  }, [lobbyId, reloadMembers, reloadLeaderboard])

  const memberMap = useMemo(() => {
    const map = new Map()
    for (const member of members) {
      map.set(member.user_id, {
        id: member.user_id,
        role: member.role,
        name: member.profiles?.display_name ?? 'Someone',
        avatarUrl: member.profiles?.avatar_url ?? null,
      })
    }
    return map
  }, [members])

  const nameOf = useCallback(
    (userId) => (userId ? (memberMap.get(userId)?.name ?? 'A former player') : null),
    [memberMap],
  )

  return {
    lobby,
    members,
    memberMap,
    bets,
    leaderboard,
    loading,
    error,
    nameOf,
    reloadMembers,
    reloadLeaderboard,
  }
}
