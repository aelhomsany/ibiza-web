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

/**
 * Destinations owned by another realm. A customer sign-in must never consume return
 * state pointing at the Platform Admin artifact (or the superseded shared `/platform`
 * routes): the customer router has no such route, so honouring it would strand the
 * user, and the realms must not be able to hand redirect state to one another at all.
 */
const FOREIGN_REALM_PREFIXES = ['/app-admin', '/platform']

/**
 * Protocol-relative (`//evil.test`) and backslash (`/\evil.test`) forms are treated by
 * browsers as absolute URLs despite starting with `/`.
 */
function isOffSiteRedirect(pathname: string): boolean {
  return pathname.startsWith('//') || pathname.startsWith('/\\')
}

export function getSafeRedirectPath(pathname: string | undefined): string | null {
  if (!pathname || !pathname.startsWith('/') || isOffSiteRedirect(pathname)) {
    return null
  }
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')
  ) {
    return null
  }
  if (
    FOREIGN_REALM_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return null
  }
  return pathname
}
