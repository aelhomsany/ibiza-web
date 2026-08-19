import { describe, expect, it } from 'vitest'

import {
  canAccessOrgRoute,
  getForbiddenRedirect,
  getHomePath,
  getOrgNavItems,
} from './rolePermissions'

describe('rolePermissions', () => {
  describe('getOrgNavItems', () => {
    it('returns 3 base items for EMPLOYEE', () => {
      const items = getOrgNavItems('EMPLOYEE')
      expect(items).toHaveLength(3)
      expect(items.map((item) => item.label)).toEqual([
        'Dashboard',
        'My Leaves',
        'Team Calendar',
      ])
    })

    it('includes Approvals for an employee assigned to the current approval step', () => {
      expect(getOrgNavItems('EMPLOYEE', true).map((item) => item.label)).toContain('Approvals')
    })

    it('returns 4 items for MANAGER including Approvals', () => {
      const items = getOrgNavItems('MANAGER')
      expect(items).toHaveLength(4)
      expect(items.map((item) => item.label)).toContain('Approvals')
      expect(items.map((item) => item.label)).not.toContain('Settings')
    })

    it('returns 5 items for HR_ADMIN including Settings', () => {
      const items = getOrgNavItems('HR_ADMIN')
      expect(items).toHaveLength(5)
      expect(items.map((item) => item.label)).toContain('Approvals')
      expect(items.map((item) => item.label)).toContain('Settings')
    })

    it('returns empty nav for PLATFORM_ADMIN', () => {
      expect(getOrgNavItems('PLATFORM_ADMIN')).toEqual([])
    })

    it('includes stable E2E testids on nav items', () => {
      const items = getOrgNavItems('HR_ADMIN')
      expect(items.map((item) => item.testId)).toEqual([
        'nav-dashboard',
        'nav-my-leaves',
        'nav-calendar',
        'nav-approvals',
        'nav-settings',
      ])
    })
  })

  describe('canAccessOrgRoute', () => {
    it('blocks PLATFORM_ADMIN from org routes', () => {
      expect(canAccessOrgRoute('PLATFORM_ADMIN', '/')).toBe(false)
    })

    it('allows org roles on base routes', () => {
      expect(canAccessOrgRoute('EMPLOYEE', '/')).toBe(true)
      expect(canAccessOrgRoute('EMPLOYEE', '/my-leaves')).toBe(true)
      expect(canAccessOrgRoute('EMPLOYEE', '/calendar')).toBe(true)
    })

    it('allows approvals for managers, HR admins, and assigned employees only', () => {
      expect(canAccessOrgRoute('EMPLOYEE', '/approvals')).toBe(false)
      expect(canAccessOrgRoute('EMPLOYEE', '/approvals', true)).toBe(true)
      expect(canAccessOrgRoute('MANAGER', '/approvals')).toBe(true)
      expect(canAccessOrgRoute('HR_ADMIN', '/approvals')).toBe(true)
    })

    it('restricts settings to HR admin only', () => {
      expect(canAccessOrgRoute('EMPLOYEE', '/settings')).toBe(false)
      expect(canAccessOrgRoute('MANAGER', '/settings')).toBe(false)
      expect(canAccessOrgRoute('HR_ADMIN', '/settings')).toBe(true)
      expect(canAccessOrgRoute('HR_ADMIN', '/settings/team')).toBe(true)
    })
  })

  describe('home redirects', () => {
    it('returns org dashboard for org roles', () => {
      expect(getHomePath('EMPLOYEE')).toBe('/')
      expect(getHomePath('MANAGER')).toBe('/')
      expect(getHomePath('HR_ADMIN')).toBe('/')
    })

    it('sends a platform admin to customer sign-in, not a platform route', () => {
      // Story 12.1 moved the operator console into its own artifact at
      // /app-admin/*. The customer graph no longer serves /platform/organizations,
      // so pointing here would strand the user on a route that does not exist.
      expect(getHomePath('PLATFORM_ADMIN')).toBe('/login')
      expect(getForbiddenRedirect('PLATFORM_ADMIN')).toBe('/login')
    })
  })
})
