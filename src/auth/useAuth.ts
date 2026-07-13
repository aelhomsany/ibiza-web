import { createContext, useContext } from 'react'
import type { UserSummaryResponse } from '../api/generated/types'

export type AuthContextValue = {
  user: UserSummaryResponse | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<UserSummaryResponse>
  logout: () => Promise<void>
  refreshUser: () => Promise<UserSummaryResponse | null>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
