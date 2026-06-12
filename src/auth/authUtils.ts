import type { UserRole } from '../api/generated/types'

export { getForbiddenRedirect, getHomePath } from './rolePermissions'

export function formatRole(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    EMPLOYEE: 'Employee',
    MANAGER: 'Manager',
    HR_ADMIN: 'HR Admin',
    PLATFORM_ADMIN: 'Platform Admin',
  }
  return labels[role] ?? role
}

export function getSafeRedirectPath(pathname: string | undefined): string | null {
  if (!pathname || !pathname.startsWith('/')) {
    return null
  }
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')
  ) {
    return null
  }
  return pathname
}
