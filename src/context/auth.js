import { createContext, useContext } from 'react'

/**
 * Kept apart from AuthProvider so the provider file exports only a component —
 * that is what lets Fast Refresh work on it during development.
 */
export const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider')
  return ctx
}
