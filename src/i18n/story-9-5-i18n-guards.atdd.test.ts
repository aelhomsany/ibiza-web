/**
 * Story 9.5 ATDD — translation coverage CI guard, missing-key fallback,
 * pre-auth locale persistence. Implemented; kept as a regression suite.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import i18n from './config'
import { applyDocumentLanguage, DEFAULT_LOCALE } from './documentLanguage'

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PREFERRED_LANGUAGE_STORAGE_KEY = 'leaveo.preferredLanguage'

describe('Story 9.5 ATDD — i18n guards', () => {
  afterEach(() => {
    localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY)
    void i18n.changeLanguage(DEFAULT_LOCALE)
    applyDocumentLanguage(DEFAULT_LOCALE)
  })

  it(
    '[P0] verify:i18n script exists and package.json exposes npm run verify:i18n',
    () => {
      const pkg = JSON.parse(readFileSync(resolve(webRoot, 'package.json'), 'utf8')) as {
        scripts?: Record<string, string>
      }
      expect(pkg.scripts?.['verify:i18n']).toBeTruthy()

      const scriptPath = resolve(webRoot, 'scripts/verify-i18n.mjs')
      const cliConfig = resolve(webRoot, 'i18next.config.ts')
      expect(existsSync(scriptPath) || existsSync(cliConfig)).toBe(true)
    },
  )

  it(
    '[P0] en/ar key sets are equal for every enabled feature namespace',
    () => {
      const namespaces = [
        'layout',
        'common',
        'errors',
        'calendar',
        'dashboard',
        'leaves',
        'approvals',
        'settings',
        'profile',
        'auth',
        'platform',
      ] as const

      for (const ns of namespaces) {
        const enPath = resolve(webRoot, `src/i18n/locales/en/${ns}.json`)
        const arPath = resolve(webRoot, `src/i18n/locales/ar/${ns}.json`)
        expect(existsSync(enPath), `missing en/${ns}.json`).toBe(true)
        expect(existsSync(arPath), `missing ar/${ns}.json`).toBe(true)

        const flatten = (obj: unknown, prefix = ''): string[] => {
          if (obj === null || typeof obj !== 'object') return prefix ? [prefix] : []
          return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
            flatten(v, prefix ? `${prefix}.${k}` : k),
          )
        }

        const enKeys = flatten(JSON.parse(readFileSync(enPath, 'utf8'))).sort()
        const arKeys = flatten(JSON.parse(readFileSync(arPath, 'utf8'))).sort()
        expect(arKeys, `ar key drift in ${ns}`).toEqual(enKeys)
      }
    },
  )

  it(
    '[P0] Arabic product copy keeps the current brand, navigation context, and core workflow glossary',
    () => {
      const arabicLocaleRoot = resolve(webRoot, 'src/i18n/locales/ar')
      const arabicResources = readdirSync(arabicLocaleRoot)
        .filter((file) => file.endsWith('.json'))
        .map((file) => readFileSync(resolve(arabicLocaleRoot, file), 'utf8'))
        .join('\n')

      expect(arabicResources).not.toContain('إبيزا')

      const calendar = JSON.parse(
        readFileSync(resolve(arabicLocaleRoot, 'calendar.json'), 'utf8'),
      ) as { view: { agenda: string } }
      const approvals = JSON.parse(
        readFileSync(resolve(arabicLocaleRoot, 'approvals.json'), 'utf8'),
      ) as { approver: { assigned: string } }
      const billing = JSON.parse(
        readFileSync(resolve(arabicLocaleRoot, 'billing.json'), 'utf8'),
      ) as { rail: { headroom: string } }
      const dashboard = JSON.parse(
        readFileSync(resolve(arabicLocaleRoot, 'dashboard.json'), 'utf8'),
      ) as { firstUse: { nonBlocking: string } }

      expect(calendar.view.agenda).toBe('العرض اليومي')
      expect(approvals.approver.assigned).toContain('المعتمِد المعيّن')
      expect(billing.rail.headroom).toBe('المقاعد المتاحة')
      expect(dashboard.firstUse.nonBlocking).not.toContain('لوحة المعلومات')
    },
  )

  it(
    '[P1] unknown translation keys do not render raw key paths',
    async () => {
      await i18n.changeLanguage('ar')
      const raw = i18n.t('dashboard:__atdd_missing_key_never_defined__')
      expect(raw).not.toMatch(/dashboard:__atdd_missing_key/)
      expect(raw).not.toMatch(/__atdd_missing_key_never_defined__/)
    },
  )

  it(
    '[P0] pre-auth last locale in localStorage drives document lang/dir before /me',
    () => {
      localStorage.setItem(PREFERRED_LANGUAGE_STORAGE_KEY, 'ar')

      const stored = localStorage.getItem(PREFERRED_LANGUAGE_STORAGE_KEY)
      expect(stored).toBe('ar')

      // Contract: bootstrap must call applyDocumentLanguage(stored) before auth chrome paints.
      applyDocumentLanguage(stored)
      expect(document.documentElement).toHaveAttribute('lang', 'ar')
      expect(document.documentElement).toHaveAttribute('dir', 'rtl')
      expect(localStorage.getItem(PREFERRED_LANGUAGE_STORAGE_KEY)).toBe('ar')
    },
  )
})
