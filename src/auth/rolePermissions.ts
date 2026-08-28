import type { UserRole } from '../api/generated/types'
import type { NavItem } from '../components/layout/Sidebar'
import { SETTINGS_REQUIRED_ROLES } from './settingsAccess'
import {
  CalendarIcon,
  CheckCircleIcon,
  ClipboardListIcon,
  DashboardIcon,
  InboxIcon,
  RefreshCwIcon,
  ReportIcon,
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
    label: 'Reports',
    path: '/reports',
    icon: ReportIcon,
    testId: 'nav-reports',
    requiredRoles: ['HR_ADMIN'],
  },
  {
    // Story 15.5: HR_ADMIN-gated like /settings, not capability-probed like /reports -- the
    // Boundaries call for mirroring the /settings nav pattern exactly.
    label: 'Data Import',
    path: '/import',
    icon: InboxIcon,
    testId: 'nav-import',
    requiredRoles: ['HR_ADMIN'],
  },
  {
    label: 'Balance Corrections',
    path: '/corrections',
    icon: RefreshCwIcon,
    testId: 'nav-corrections',
    requiredRoles: ['HR_ADMIN'],
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: SettingsIcon,
    testId: 'nav-settings',
    requiredRoles: SETTINGS_REQUIRED_ROLES,
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

export function getOrgNavItems(
  role: UserRole,
  canReviewApprovals = role === 'MANAGER' || role === 'HR_ADMIN',
  // ADVANCED_REPORTING is COMING_SOON in the production catalog until Story 13.5, so
  // an un-gated Reports item would send every HR admin to a denial banner. Callers that
  // know the plan pass the probe result; the default keeps role-only behavior.
  canAccessReports = role === 'HR_ADMIN',
): NavItem[] {
  if (role === 'PLATFORM_ADMIN') {
    return []
  }

  return ORG_NAV_ITEMS.filter((item) => {
    if (item.path === '/approvals') return canReviewApprovals
    if (item.path === '/reports') {
      return item.requiredRoles.includes(role) && canAccessReports
    }
    return item.requiredRoles.includes(role)
  }).map((item) => ({
    label: item.label,
    path: item.path,
    icon: item.icon,
    testId: item.testId,
  }))
}

export function canAccessOrgRoute(
  role: UserRole,
  pathname: string,
  canReviewApprovals = role === 'MANAGER' || role === 'HR_ADMIN',
): boolean {
  if (role === 'PLATFORM_ADMIN') {
    return false
  }

  if (pathname === '/approvals' || pathname.startsWith('/approvals/')) {
    return canReviewApprovals
  }

  if (pathname === '/settings' || pathname.startsWith('/settings/')) {
    return role === 'HR_ADMIN'
  }

  if (pathname === '/reports' || pathname.startsWith('/reports/')) {
    return role === 'HR_ADMIN'
  }

  if (pathname === '/import' || pathname.startsWith('/import/')) {
    return role === 'HR_ADMIN'
  }

  if (pathname === '/corrections' || pathname.startsWith('/corrections/')) {
    return role === 'HR_ADMIN'
  }

  if (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) {
    return role === 'HR_ADMIN'
  }

  return true
}
