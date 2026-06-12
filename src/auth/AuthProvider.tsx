import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getMe,
  postLogin,
  postLogout,
  postRefresh,
  setAuthFailureHandler,
} from '../api/client'
import type { UserSummaryResponse } from '../api/generated/types'
import { getBrowserTimezone } from './timezone'
import { clearAccessToken } from './tokenStorage'
import { AuthContext, type AuthContextValue } from './useAuth'

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate()
  const [user, setUser] = useState<UserSummaryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const clearSession = useCallback(() => {
    clearAccessToken()
    setUser(null)
  }, [])

  const logout = useCallback(async () => {
    try {
      await postLogout()
    } catch {
      // ignore logout API errors — session is cleared in finally regardless
    } finally {
      clearSession()
      navigate('/login', { replace: true })
    }
  }, [clearSession, navigate])

  const restoreSession = useCallback(async () => {
    try {
      await postRefresh()
      const me = await getMe()
      setUser(me)
    } catch {
      clearSession()
    } finally {
      setIsLoading(false)
    }
  }, [clearSession])

  useEffect(() => {
    void restoreSession()
  }, [restoreSession])

  useEffect(() => {
    setAuthFailureHandler(() => {
      clearSession()
      navigate('/login', { replace: true })
    })
    return () => setAuthFailureHandler(null)
  }, [clearSession, navigate])

  const login = useCallback(async (email: string, password: string) => {
    await postLogin({ email, password, timezone: getBrowserTimezone() })
    const me = await getMe()
    setUser(me)
    return me
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
