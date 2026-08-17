import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchBets, fetchLeaderboard, fetchLobby, fetchMembers } from '../lib/rpc'

async function loadEverything(lobbyId) {
  const [lobby, members, bets, leaderboard] = await Promise.all([
    fetchLobby(lobbyId),
    fetchMembers(lobbyId),
    fetchBets(lobbyId),
    fetchLeaderboard(lobbyId),
  ])
  return { lobby, members: members ?? [], bets: bets ?? [], leaderboard: leaderboard ?? [] }
}

const NO_ACCESS = 'This lobby does not exist, or you have not joined it yet.'

/**
 * Loads a lobby and keeps it live.
 *
 * This is the Supabase Realtime replacement for the old Socket.IO server: we
 * subscribe to Postgres changes scoped to one lobby_id, so a phone and the
 * dashboard on the TV stay in sync without any server of our own. Bet rows
 * arrive as raw columns, so names are resolved locally against the roster —
 * that way a realtime row and a fetched row render identically.
 *
 * postgres_changes streams live WAL and never replays, so anything that happened
 * while the socket was down is lost. Phones lock and WiFi blips, so the hook
 * refetches whenever the channel (re-)subscribes, the tab becomes visible again,
 * or the browser reports it is back online. Without that a backgrounded phone —
 * or the TV after a 20-second blip — silently shows stale bets all evening.
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

  const apply = useCallback(
    (data) => {
      setLobby(data.lobby)
      setMembers(data.members)
      setBets(data.bets)
      setLeaderboard(data.leaderboard)
      setFailure(null)
      setLoadedFor(lobbyId)
    },
    [lobbyId],
  )

  /** Full resync. Safe to call repeatedly; never flips the UI back to a spinner. */
  const refresh = useCallback(async () => {
    try {
      const data = await loadEverything(lobbyId)
      if (!alive.current) return
      if (!data.lobby) {
        // RLS stopped returning the row — you were removed, or the lobby is gone.
        setFailure({ lobbyId, message: NO_ACCESS })
        return
      }
      apply(data)
    } catch {
      // A failed background refresh keeps whatever is on screen; the next
      // reconnect or visibility change tries again.
    }
  }, [lobbyId, apply])

  const reloadMembers = useCallback(async () => {
    const rows = await fetchMembers(lobbyId).catch(() => null)
    if (!rows || !alive.current) return
    // A lobby always contains at least its host, so an empty roster can only
    // mean RLS stopped returning rows — i.e. you are no longer a member.
    if (rows.length === 0) {
      setFailure({ lobbyId, message: 'You are no longer in this lobby.' })
      return
    }
    setMembers(rows)
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
        const data = await loadEverything(lobbyId)
        if (cancelled) return
        if (!data.lobby) {
          setFailure({ lobbyId, message: NO_ACCESS })
          return
        }
        apply(data)
      } catch (err) {
        if (!cancelled) {
          setFailure({ lobbyId, message: err.message || 'Could not load this lobby.' })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [lobbyId, apply])

  // Realtime
  useEffect(() => {
    if (!lobbyId) return undefined

    let boardTimer = null
    const scheduleBoardRefresh = () => {
      clearTimeout(boardTimer)
      // Bursts of accepts shouldn't each trigger their own round trip.
      boardTimer = setTimeout(reloadLeaderboard, 400)
    }

    // The first SUBSCRIBED coincides with the initial fetch, so skip it; every
    // later one is a rejoin after a drop and is exactly when we need to resync.
    let subscribedBefore = false

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
      // Display names live on profiles, which has no lobby_id to filter on.
      // RLS already limits this to people you share a lobby with.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        reloadMembers()
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        if (subscribedBefore) refresh()
        subscribedBefore = true
      })

    return () => {
      clearTimeout(boardTimer)
      supabase.removeChannel(channel)
    }
  }, [lobbyId, reloadMembers, reloadLeaderboard, refresh])

  // A locked phone or a closed laptop lid kills the socket without any channel
  // error, so waking the tab is its own resync trigger.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', refresh)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', refresh)
    }
  }, [refresh])

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
    refresh,
  }
}
