import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  applyDocumentLanguage,
  DEFAULT_LOCALE,
  getStoredPreferredLanguage,
  isSupportedLocale,
  storePreferredLanguage,
} from '../../i18n/documentLanguage'
import i18n from '../../i18n/config'
import {
  getPlatformMe,
  postPlatformLogin,
  postPlatformLogout,
  postPlatformRefresh,
  setPlatformAuthFailureHandler,
  type PlatformAdminSummary,
} from './platformApiClient'
import { clearPlatformAccessToken } from './platformTokenStorage'
import {
  PlatformAuthContext,
  type PlatformAuthContextValue,
} from './usePlatformAuth'

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<PlatformAdminSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const clearSession = useCallback(() => {
    clearPlatformAccessToken()
    setUser(null)
  }, [])

  const logout = useCallback(async () => {
    try {
      await postPlatformLogout()
    } catch {
      // Realm-local memory is cleared even when the logout service is unavailable.
    } finally {
      clearSession()
      navigate('/app-admin/login', { replace: true })
    }
  }, [clearSession, navigate])

  const restore = useCallback(async () => {
    try {
      await postPlatformRefresh()
      setUser(await getPlatformMe())
    } catch {
      clearSession()
    } finally {
      setIsLoading(false)
    }
  }, [clearSession])

  useEffect(() => {
    void restore()
  }, [restore])

  useEffect(() => {
    const locale = isSupportedLocale(user?.preferredLanguage)
      ? user.preferredLanguage
      : getStoredPreferredLanguage() || DEFAULT_LOCALE
    storePreferredLanguage(locale)
    void i18n.changeLanguage(locale).then(() => applyDocumentLanguage(locale))
  }, [user?.preferredLanguage])

  useEffect(() => {
    setPlatformAuthFailureHandler(() => {
      clearSession()
      navigate('/app-admin/login', { replace: true })
    })
    return () => setPlatformAuthFailureHandler(null)
  }, [clearSession, navigate])

  const login = useCallback(async (email: string, password: string) => {
    await postPlatformLogin(email, password)
    const summary = await getPlatformMe()
    setUser(summary)
    return summary
  }, [])

  const value = useMemo<PlatformAuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  )

  return (
    <PlatformAuthContext.Provider value={value}>
      {children}
    </PlatformAuthContext.Provider>
  )
}
