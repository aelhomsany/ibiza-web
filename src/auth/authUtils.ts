export { getForbiddenRedirect, getHomePath } from './rolePermissions'

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return '?'
  }
  if (parts.length === 1) {
    return [...parts[0]][0].toUpperCase()
  }
  const first = [...parts[0]][0]
  const last = [...parts[parts.length - 1]][0]
  return `${first}${last}`.toUpperCase()
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
