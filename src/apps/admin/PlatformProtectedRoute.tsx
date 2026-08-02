import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatformAuth } from '../../features/platform-auth/usePlatformAuth'

export function PlatformProtectedRoute() {
  const { t } = useTranslation('platformAuth')
  const { isAuthenticated, isLoading } = usePlatformAuth()
  const location = useLocation()
  if (isLoading) {
    return (
      <main className="platform-login-loading">
        <p>{t('loading')}</p>
      </main>
    )
  }
  if (!isAuthenticated) {
    return <Navigate to="/app-admin/login" replace state={{ realm: 'platform', from: location.pathname }} />
  }
  return <Outlet />
}
