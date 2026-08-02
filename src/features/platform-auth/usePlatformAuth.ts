import { createContext, useContext } from 'react'
import type { PlatformAdminSummary } from './platformApiClient'

export type PlatformAuthContextValue = {
  user: PlatformAdminSummary | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<PlatformAdminSummary>
  logout: () => Promise<void>
}

export const PlatformAuthContext = createContext<PlatformAuthContextValue | null>(null)

export function usePlatformAuth() {
  const context = useContext(PlatformAuthContext)
  if (!context) {
    throw new Error('usePlatformAuth must be used within PlatformAuthProvider')
  }
  return context
}
