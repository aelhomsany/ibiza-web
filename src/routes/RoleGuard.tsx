import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { UserRole } from '../api/generated/types'
import { canAccessOrgRoute, getHomePath } from '../auth/rolePermissions'
import { useAuth } from '../auth/useAuth'
import { useTranslation } from 'react-i18next'

type RoleGuardProps = {
  allowedRoles?: UserRole[]
  shell?: 'org' | 'admin'
}

export function RoleGuard({ allowedRoles, shell }: RoleGuardProps) {
  const { t } = useTranslation('common')
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="auth-loading" data-testid="auth-loading">
        {t('loading')}
      </div>
    )
  }

  if (!user) {
    return null
  }

  const role = user.role

  // Shell-level org guard: delegates to canAccessOrgRoute as the single source of truth.
  // Handles both cross-shell blocking (PLATFORM_ADMIN) and route-level restrictions
  // (/approvals, /settings and sub-paths) so inner allowedRoles wrappers are not needed.
  if (shell === 'org' && !canAccessOrgRoute(role, location.pathname)) {
    return <Navigate to={getHomePath(role)} replace state={{ from: location }} />
  }

  if (shell === 'admin' && role !== 'PLATFORM_ADMIN') {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  // Fallback for non-shell role restrictions (available for future use).
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={getHomePath(role)} replace />
  }

  return <Outlet />
}
