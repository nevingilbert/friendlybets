import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * False when the two env vars are missing — the app renders a setup screen
 * instead of crashing with an opaque `createClient` error.
 */
export const isSupabaseConfigured = Boolean(url && publishableKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Lets the OAuth redirect land straight back on the page it started
        // from — including an /join/CODE invite link.
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      realtime: {
        params: { eventsPerSecond: 20 },
      },
    })
  : null
