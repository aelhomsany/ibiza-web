import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
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

    it('[P0] returns 8 items for HR_ADMIN including Reports, Data Import, Balance Corrections and Settings', () => {
      const items = getOrgNavItems('HR_ADMIN')
      expect(items).toHaveLength(8)
      expect(items.map((item) => item.label)).toContain('Approvals')
      expect(items.map((item) => item.label)).toContain('Reports')
      expect(items.map((item) => item.label)).toContain('Data Import')
      expect(items.map((item) => item.label)).toContain('Balance Corrections')
      expect(items.map((item) => item.label)).toContain('Settings')
    })

    it('[P0] does not expose Reports navigation to employees or managers', () => {
      expect(getOrgNavItems('EMPLOYEE').map((item) => item.label)).not.toContain('Reports')
      expect(getOrgNavItems('MANAGER').map((item) => item.label)).not.toContain('Reports')
    })

    it('[P0] hides Reports navigation when the plan does not entitle reporting', () => {
      // ADVANCED_REPORTING is COMING_SOON in the production catalog until Story 13.5;
      // an un-gated nav item would send every HR admin to a denial banner.
      const items = getOrgNavItems('HR_ADMIN', true, false)
      expect(items.map((item) => item.label)).not.toContain('Reports')
      expect(items.map((item) => item.label)).toContain('Settings')
      expect(getOrgNavItems('HR_ADMIN', true, true).map((item) => item.label))
        .toContain('Reports')
    })

    it('returns empty nav for PLATFORM_ADMIN', () => {
      expect(getOrgNavItems('PLATFORM_ADMIN')).toEqual([])
    })

    // The `label` fields above are only the fallback `OrgShell` uses when a `layout:nav.<key>`
    // key is missing — a missing key is what made the Arabic sidebar render English for
    // /import and /corrections (UX-DR32). Every catalog item must have a translated label in
    // both locales so that fallback is never reached.
    it('[P0] every nav testId resolves to a layout:nav key in both locales', () => {
      const layoutFor = (locale: 'en' | 'ar') =>
        JSON.parse(
          readFileSync(
            resolve(dirname(fileURLToPath(import.meta.url)), `../i18n/locales/${locale}/layout.json`),
            'utf8',
          ),
        ) as { nav: Record<string, string> }

      const en = layoutFor('en')
      const ar = layoutFor('ar')
      for (const item of getOrgNavItems('HR_ADMIN')) {
        const source = item.testId?.replace('nav-', '') ?? ''
        const key = source === 'my-leaves' ? 'myLeaves' : source
        expect(en.nav[key], `en layout:nav.${key}`).toBeTruthy()
        expect(ar.nav[key], `ar layout:nav.${key}`).toBeTruthy()
      }
    })

    it('includes stable E2E testids on nav items', () => {
      const items = getOrgNavItems('HR_ADMIN')
      expect(items.map((item) => item.testId)).toEqual([
        'nav-dashboard',
        'nav-my-leaves',
        'nav-calendar',
        'nav-approvals',
        'nav-reports',
        'nav-import',
        'nav-corrections',
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

    it('[P0] restricts reports to HR admin only', () => {
      expect(canAccessOrgRoute('EMPLOYEE', '/reports')).toBe(false)
      expect(canAccessOrgRoute('MANAGER', '/reports')).toBe(false)
      expect(canAccessOrgRoute('HR_ADMIN', '/reports')).toBe(true)
    })

    it('[P0] restricts data import to HR admin only, mirroring /settings', () => {
      expect(canAccessOrgRoute('EMPLOYEE', '/import')).toBe(false)
      expect(canAccessOrgRoute('MANAGER', '/import')).toBe(false)
      expect(canAccessOrgRoute('HR_ADMIN', '/import')).toBe(true)
    })

    it('[P0] restricts balance corrections to HR admin only, mirroring /settings', () => {
      expect(canAccessOrgRoute('EMPLOYEE', '/corrections')).toBe(false)
      expect(canAccessOrgRoute('MANAGER', '/corrections')).toBe(false)
      expect(canAccessOrgRoute('HR_ADMIN', '/corrections')).toBe(true)
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
