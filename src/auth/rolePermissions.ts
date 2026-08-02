import type { UserRole } from '../api/generated/types'
import type { NavItem } from '../components/layout/Sidebar'
import {
  CalendarIcon,
  CheckCircleIcon,
  ClipboardListIcon,
  DashboardIcon,
  SettingsIcon,
} from '../components/ui/icons'

export const ORG_ROLES = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN'] as const satisfies readonly UserRole[]

export type OrgRole = (typeof ORG_ROLES)[number]

type NavCatalogItem = NavItem & {
  requiredRoles: UserRole[]
}

const ORG_BASE: NavCatalogItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: DashboardIcon,
    testId: 'nav-dashboard',
    requiredRoles: [...ORG_ROLES],
  },
  {
    label: 'My Leaves',
    path: '/my-leaves',
    icon: ClipboardListIcon,
    testId: 'nav-my-leaves',
    requiredRoles: [...ORG_ROLES],
  },
  {
    label: 'Team Calendar',
    path: '/calendar',
    icon: CalendarIcon,
    testId: 'nav-calendar',
    requiredRoles: [...ORG_ROLES],
  },
  {
    label: 'Approvals',
    path: '/approvals',
    icon: CheckCircleIcon,
    testId: 'nav-approvals',
    requiredRoles: ['MANAGER', 'HR_ADMIN'],
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: SettingsIcon,
    testId: 'nav-settings',
    requiredRoles: ['HR_ADMIN'],
  },
]

export const ORG_NAV_ITEMS: NavCatalogItem[] = ORG_BASE

export function getHomePath(role: UserRole): string {
  // Customer artifact only. A Platform Admin has no destination here — operators
  // sign in at /app-admin/login in the separate Admin artifact, and the API no longer
  // issues a customer token for one. Pointing this at /platform/organizations would
  // send them to a route the customer router no longer serves.
  return role === 'PLATFORM_ADMIN' ? '/login' : '/'
}

export function getForbiddenRedirect(role: UserRole): string {
  return getHomePath(role)
}

export function getOrgNavItems(role: UserRole): NavItem[] {
  if (role === 'PLATFORM_ADMIN') {
    return []
  }

  return ORG_NAV_ITEMS.filter((item) => item.requiredRoles.includes(role)).map((item) => ({
    label: item.label,
    path: item.path,
    icon: item.icon,
    testId: item.testId,
  }))
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
