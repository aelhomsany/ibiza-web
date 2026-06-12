import type { UserRole } from '../api/generated/types'
import type { NavItem } from '../components/layout/Sidebar'

export const ORG_ROLES = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN'] as const satisfies readonly UserRole[]

export type OrgRole = (typeof ORG_ROLES)[number]

type NavCatalogItem = NavItem & {
  requiredRoles: UserRole[]
}

const ORG_BASE: NavCatalogItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: '📊',
    testId: 'nav-dashboard',
    requiredRoles: [...ORG_ROLES],
  },
  {
    label: 'My Leaves',
    path: '/my-leaves',
    icon: '📋',
    testId: 'nav-my-leaves',
    requiredRoles: [...ORG_ROLES],
  },
  {
    label: 'Team Calendar',
    path: '/calendar',
    icon: '📅',
    testId: 'nav-calendar',
    requiredRoles: [...ORG_ROLES],
  },
  {
    label: 'Approvals',
    path: '/approvals',
    icon: '✅',
    testId: 'nav-approvals',
    requiredRoles: ['MANAGER', 'HR_ADMIN'],
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: '⚙️',
    testId: 'nav-settings',
    requiredRoles: ['HR_ADMIN'],
  },
]

export const ORG_NAV_ITEMS: NavCatalogItem[] = ORG_BASE

export function getHomePath(role: UserRole): string {
  return role === 'PLATFORM_ADMIN' ? '/platform/organizations' : '/'
}

export function getForbiddenRedirect(role: UserRole): string {
  return getHomePath(role)
}

export function getOrgNavItems(role: UserRole): NavItem[] {
  if (role === 'PLATFORM_ADMIN') {
    return []
  }

  return ORG_NAV_ITEMS.filter((item) => item.requiredRoles.includes(role)).map(
    ({ requiredRoles: _requiredRoles, ...navItem }) => navItem,
  )
}

export function canAccessAdminRoute(role: UserRole): boolean {
  return role === 'PLATFORM_ADMIN'
}

export function canAccessOrgRoute(role: UserRole, pathname: string): boolean {
  if (role === 'PLATFORM_ADMIN') {
    return false
  }

  if (pathname === '/approvals' || pathname.startsWith('/approvals/')) {
    return role === 'MANAGER' || role === 'HR_ADMIN'
  }

  if (pathname === '/settings' || pathname.startsWith('/settings/')) {
    return role === 'HR_ADMIN'
  }

  return true
}
