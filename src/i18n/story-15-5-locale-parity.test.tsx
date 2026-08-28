/**
 * Story 15.5 — Arabic coverage for the two namespaces Epic 15 added. Before this, `import` and
 * `corrections` had no Arabic assertion at all, and the sidebar rendered the hardcoded English
 * labels from `rolePermissions.ts` because `layout:nav.import`/`nav.corrections` did not exist
 * (UX-DR32). `defaultValue` cannot cover for a missing key here: `parseMissingKeyHandler` returns
 * `''`, so a gap renders blank and still passes `toBeVisible()` — every assertion below pins real
 * text.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../api/client'
import { ToastProvider } from '../components/ui/ToastProvider'
import { CorrectionsPage } from '../features/corrections/CorrectionsPage'
import { ImportWizardPage } from '../features/import/ImportWizardPage'
import { AuthTestProvider, createMockAuthForRole } from '../test/authTestUtils'
import i18n from './config'
import { applyDocumentLanguage, DEFAULT_LOCALE } from './documentLanguage'

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function flatten(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return prefix ? [prefix] : []
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  )
}

function localeKeys(locale: 'en' | 'ar', namespace: string): string[] {
  const path = resolve(webRoot, `src/i18n/locales/${locale}/${namespace}.json`)
  return flatten(JSON.parse(readFileSync(path, 'utf8'))).sort()
}

function renderInAr(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <AuthTestProvider value={createMockAuthForRole('HR_ADMIN')}>{node}</AuthTestProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Story 15.5 — import/corrections locale parity', () => {
  it('[P0] en and ar key sets are identical for the import and corrections namespaces', () => {
    for (const namespace of ['import', 'corrections'] as const) {
      expect(localeKeys('ar', namespace), `ar/${namespace}.json drifted from en`).toEqual(
        localeKeys('en', namespace),
      )
      expect(localeKeys('en', namespace).length).toBeGreaterThan(0)
    }
  })

  it('[P0] the sidebar nav keys for both pages exist in en and ar', () => {
    for (const locale of ['en', 'ar'] as const) {
      const keys = localeKeys(locale, 'layout')
      expect(keys, `${locale}/layout.json`).toContain('nav.import')
      expect(keys, `${locale}/layout.json`).toContain('nav.corrections')
    }
  })
})

describe('Story 15.5 — Arabic rendering', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ar')
    applyDocumentLanguage('ar')
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await i18n.changeLanguage(DEFAULT_LOCALE)
    applyDocumentLanguage(DEFAULT_LOCALE)
  })

  it('[P0] renders the import wizard in Arabic, not English fallbacks', async () => {
    vi.spyOn(apiClient, 'listImportJobs').mockResolvedValue({ items: [], page: 0, size: 10, total: 0 })

    renderInAr(<ImportWizardPage />)

    await screen.findByTestId('import-start')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('استيراد البيانات')
    expect(screen.getByRole('button', { name: 'بدء الاستيراد' })).toBeInTheDocument()
    expect(screen.getByTestId('import-history-empty')).toHaveTextContent('لا توجد عمليات استيراد بعد.')
  })

  it('[P0] renders the corrections page in Arabic, not English fallbacks', async () => {
    vi.spyOn(apiClient, 'getPolicySettingsOverview').mockResolvedValue({
      leaveTypes: [],
      users: [],
      workforceGroups: [],
    } as unknown as Awaited<ReturnType<typeof apiClient.getPolicySettingsOverview>>)
    vi.spyOn(apiClient, 'listBalanceCorrections').mockResolvedValue({
      items: [],
      page: 0,
      size: 50,
      total: 0,
    })

    renderInAr(<CorrectionsPage />)

    await screen.findByTestId('correction-form')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('تصحيحات الرصيد')
    expect(screen.getByRole('button', { name: 'مراجعة التصحيح' })).toBeInTheDocument()
    expect(screen.getByTestId('correction-ledger-empty')).toHaveTextContent('لا توجد تصحيحات مسجّلة بعد.')
  })
})
