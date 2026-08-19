import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { UserRole } from '../api/generated/types'
import { canAccessOrgRoute, getHomePath } from '../auth/rolePermissions'
import { useAuth } from '../auth/useAuth'
import { useTranslation } from 'react-i18next'
import { useApprovalCapability } from '../features/approvals/useApprovalCapability'

// Customer artifact only. The Platform Admin shell moved to its own artifact in
// Story 12.1 and is guarded there by PlatformProtectedRoute against
// PlatformAuthProvider, so there is no 'admin' shell for this guard to serve.
type RoleGuardProps = {
  allowedRoles?: UserRole[]
  shell?: 'org'
}

export function RoleGuard({ allowedRoles, shell }: RoleGuardProps) {
  const { t } = useTranslation('common')
  const { user, isLoading } = useAuth()
  const location = useLocation()
  const capability = useApprovalCapability()

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
  const isApprovalRoute = location.pathname === '/approvals'
    || location.pathname.startsWith('/approvals/')
  // useApprovalCapability seeds `data` with an optimistic guess (initialData), so `data == null`
  // never happens here — `dataUpdatedAt === 0` is the real signal that we're still on that
  // placeholder and haven't heard from the server yet. Wait for the live check whenever that's
  // true, regardless of what the optimistic guess itself was — an optimistic "true" (stale
  // cache or role heuristic) must not render the Approvals route for a user whose assignment
  // was just revoked.
  if (shell === 'org' && isApprovalRoute && capability.isFetching && capability.dataUpdatedAt === 0) {
    return (
      <div className="auth-loading" data-testid="approval-capability-loading">
        {t('loading')}
      </div>
    )
  }
  const canReviewApprovals = capability.data?.canReviewApprovals
    ?? user.canReviewApprovals
    ?? (role === 'MANAGER' || role === 'HR_ADMIN')

  // Shell-level org guard: delegates to canAccessOrgRoute as the single source of truth.
  // Handles both cross-shell blocking (PLATFORM_ADMIN) and route-level restrictions
  // (/approvals, /settings and sub-paths) so inner allowedRoles wrappers are not needed.
  if (shell === 'org' && !canAccessOrgRoute(
    role,
    location.pathname,
    canReviewApprovals,
  )) {
    return <Navigate to={getHomePath(role)} replace state={{ from: location }} />
  }

  // Fallback for non-shell role restrictions (available for future use).
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={getHomePath(role)} replace />
  }

  return <Outlet />
}
