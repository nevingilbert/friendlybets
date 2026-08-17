import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchProfile } from '../lib/rpc'
import { AuthContext } from './auth'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // The profile row is created by a trigger on auth.users. On a brand new
  // sign-in the row can lag the session by a few ms, so retry briefly.
  const loadProfile = useCallback(async (userId) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const row = await fetchProfile(userId).catch(() => null)
      if (row) return row
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
    }
    return null
  }, [])

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      setSession(data.session ?? null)
      if (data.session?.user) {
        const row = await loadProfile(data.session.user.id)
        if (!cancelled && mounted.current) setProfile(row)
      }
      if (!cancelled && mounted.current) setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (cancelled) return
      setSession(nextSession ?? null)

      if (!nextSession?.user) {
        setProfile(null)
        return
      }
      // TOKEN_REFRESHED fires often and carries the same user — no need to refetch.
      if (event === 'TOKEN_REFRESHED') return

      const row = await loadProfile(nextSession.user.id)
      if (!cancelled && mounted.current) setProfile(row)
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signInWithGoogle = useCallback(async (redirectTo) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Sending the user back to where they started is what makes an invite
        // link survive the round-trip through Google.
        redirectTo: redirectTo || window.location.href,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) throw new Error(error.message)
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signInWithGoogle,
      signOut,
      setProfile,
    }),
    [session, profile, loading, signInWithGoogle, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
