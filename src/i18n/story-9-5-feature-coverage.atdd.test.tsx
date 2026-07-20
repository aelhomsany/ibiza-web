/**
 * Story 9.5 ATDD — sample feature chrome under Arabic must use translation
 * keys (not English literals / not raw key paths). API business names stay as-is.
 * Implemented; kept as a regression suite.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../api/client'
import type { UserRole } from '../api/generated/types'
import { AuthTestProvider, createMockAuthForRole, createMockAuthValue, mockUsers } from '../test/authTestUtils'
import { ToastProvider } from '../components/ui/ToastProvider'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { ApprovalsPage } from '../features/approvals/ApprovalsPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { ProfilePage } from '../features/profile/ProfilePage'
import { LoginPage } from '../features/login/LoginPage'
import { OrganizationsPage } from '../features/platform/OrganizationsPage'
import i18n from './config'
import { applyDocumentLanguage, DEFAULT_LOCALE } from './documentLanguage'

function wrap(ui: ReactElement, role: UserRole = 'EMPLOYEE') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const base = createMockAuthForRole(role)
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <AuthTestProvider
            value={createMockAuthValue({
              ...base,
              user: { ...mockUsers.employee, ...base.user, preferredLanguage: 'ar', role },
            })}
          >
            {ui}
          </AuthTestProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

async function activateArabic() {
  await i18n.changeLanguage('ar')
  applyDocumentLanguage('ar')
  expect(document.documentElement).toHaveAttribute('lang', 'ar')
  expect(document.documentElement).toHaveAttribute('dir', 'rtl')
}

function stubDashboardApis() {
  vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue([])
  vi.spyOn(apiClient, 'getDashboardRecentRequests').mockResolvedValue([])
  vi.spyOn(apiClient, 'getDashboardOutToday').mockResolvedValue([])
  vi.spyOn(apiClient, 'getDashboardUpcoming').mockResolvedValue([])
  vi.spyOn(apiClient, 'getPendingApprovalCount').mockResolvedValue({ count: 0 })
}

describe('Story 9.5 ATDD — feature translation coverage', () => {
  afterEach(async () => {
    vi.restoreAllMocks()
    await i18n.changeLanguage(DEFAULT_LOCALE)
    applyDocumentLanguage(DEFAULT_LOCALE)
  })

  it(
    '[P0] Dashboard Request Leave CTA is Arabic (not "Request Leave", not raw key)',
    async () => {
      stubDashboardApis()
      await activateArabic()
      wrap(<DashboardPage />)

      await waitFor(() => expect(screen.getByTestId('request-leave-btn')).toBeInTheDocument())
      const btn = screen.getByTestId('request-leave-btn')
      expect(btn).not.toHaveTextContent('Request Leave')
      expect(btn.textContent ?? '').not.toMatch(/dashboard:/i)
      // Planned key dashboard:actions.requestLeave → Arabic value (adjust if key naming differs in impl)
      expect(btn).toHaveTextContent(/طلب/)
    },
  )

  it(
    '[P1] Approvals page title / empty state use Arabic chrome',
    async () => {
      vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue([])
      vi.spyOn(apiClient, 'getRecentApprovalDecisions').mockResolvedValue([])
      await activateArabic()
      wrap(<ApprovalsPage />, 'MANAGER')

      await waitFor(() => expect(screen.getByTestId('approvals-empty-state')).toBeInTheDocument())
      expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('Approvals')
      expect(screen.getByTestId('approvals-empty-state')).not.toHaveTextContent('All caught up!')
      expect(screen.getByTestId('approvals-empty-state').textContent ?? '').not.toMatch(/approvals:/i)
    },
  )

  it(
    '[P1] Settings page title is Arabic',
    async () => {
      await activateArabic()
      wrap(<SettingsPage />, 'HR_ADMIN')

      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument())
      const title = screen.getByRole('heading', { level: 1 })
      expect(title).not.toHaveTextContent('Settings')
      expect(title.textContent ?? '').not.toMatch(/settings:/i)
    },
  )

  it(
    '[P1] Profile preferred-language label is Arabic',
    async () => {
      await activateArabic()
      wrap(<ProfilePage />)

      await waitFor(() => expect(screen.getByTestId('profile-page')).toBeInTheDocument())
      expect(screen.queryByText('Preferred language')).not.toBeInTheDocument()
      expect(screen.getByTestId('profile-page').textContent ?? '').not.toMatch(/profile:/i)
    },
  )

  it(
    '[P1] Login title/submit use Arabic when pre-auth locale is ar',
    async () => {
      await activateArabic()
      render(
        <MemoryRouter>
          <AuthTestProvider
            value={createMockAuthValue({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              login: vi.fn(),
            })}
          >
            <LoginPage />
          </AuthTestProvider>
        </MemoryRouter>,
      )

      expect(screen.getByTestId('login-page')).toBeInTheDocument()
      expect(screen.getByTestId('login-page')).not.toHaveTextContent('Sign in to your account')
      expect(screen.getByTestId('sign-in-submit')).not.toHaveTextContent(/^Sign in$/)
      expect(screen.getByTestId('login-page').textContent ?? '').not.toMatch(/auth:/i)
    },
  )

  it(
    '[P1] Platform Organizations chrome is Arabic',
    async () => {
      vi.spyOn(apiClient, 'getPlatformOrganizations').mockResolvedValue([])
      await activateArabic()
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      render(
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <OrganizationsPage />
          </ToastProvider>
        </QueryClientProvider>,
      )

      await waitFor(() => expect(screen.getByTestId('organizations-page')).toBeInTheDocument())
      const title = screen.getByRole('heading', { level: 1 })
      expect(title).not.toHaveTextContent(/^Organizations$/)
      expect(title.textContent ?? '').not.toMatch(/platform:/i)
    },
  )

  it(
    '[P1] API leave-type name remains untranslated business content on Dashboard — enable with dashboard extraction',
    async () => {
      stubDashboardApis()
      vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue([
        {
          leaveTypeId: 1,
          name: 'Annual Leave',
          icon: '🌴',
          color: '#093C5D',
          backgroundColor: '#D6E8ED',
          borderColor: '#0E4F75',
          displayOrder: 1,
          capped: true,
          allocatedDays: 20,
          usedDays: 0,
          remainingDays: 20,
        },
      ])
      await activateArabic()
      wrap(<DashboardPage />)

      await waitFor(() => expect(screen.getByTestId('balance-grid')).toBeInTheDocument())
      // Business content from API must stay English product data (not wrapped in t())
      expect(screen.getByText('Annual Leave')).toBeInTheDocument()
    },
  )
})
