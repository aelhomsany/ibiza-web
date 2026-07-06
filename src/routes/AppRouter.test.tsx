import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import * as apiClient from '../api/client'
import {
  AuthTestProvider,
  createMockAuthForRole,
  createMockAuthValue,
} from '../test/authTestUtils'
import { AppRoutes } from './AppRouter'
import { mockCalendarMonth } from '../features/calendar/calendarTestFixtures'

function renderAppRoutes(initialEntries: string[], authValue = createMockAuthForRole('EMPLOYEE')) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthTestProvider value={authValue}>
          <AppRoutes />
        </AuthTestProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AppRoutes', () => {
  beforeEach(() => {
    // Pin Date to the calendar fixture month (June 2026) so TeamCalendarPage
    // bootstraps to the fixture month and does not double-fetch (see
    // TeamCalendarPage.test.tsx for details). Only Date is faked.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-06-15T12:00:00Z') })
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      { id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] },
      { id: 2, name: 'Egypt', weekendDays: ['FRIDAY', 'SATURDAY'] },
    ])
    vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([])
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue([])
    vi.spyOn(apiClient, 'getCalendarMonth').mockResolvedValue(mockCalendarMonth)
    vi.spyOn(apiClient, 'getPlatformOrganizations').mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('redirects unauthenticated users from root to login', async () => {
    renderAppRoutes(
      ['/'],
      createMockAuthValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      }),
    )

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  it('renders org shell at root route when authenticated', async () => {
    renderAppRoutes(['/'], createMockAuthForRole('EMPLOYEE'))

    // Pages are lazy-loaded, so wait for the chunk to resolve.
    expect(await screen.findByTestId('dashboard-page')).toBeInTheDocument()
    expect(screen.getByTestId('org-shell')).toBeInTheDocument()
    expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument()
  })

  it('renders admin shell at platform route when authenticated as platform admin', async () => {
    renderAppRoutes(['/platform/organizations'], createMockAuthForRole('PLATFORM_ADMIN'))

    expect(await screen.findByRole('heading', { name: 'Organizations' })).toBeInTheDocument()
    expect(screen.getByTestId('admin-shell')).toBeInTheDocument()
  })

  it('redirects org user away from platform routes', async () => {
    renderAppRoutes(['/platform/organizations'], createMockAuthForRole('MANAGER'))

    await waitFor(() => {
      expect(screen.getByTestId('org-shell')).toBeInTheDocument()
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('admin-shell')).not.toBeInTheDocument()
  })

  it('redirects platform admin away from org routes', async () => {
    renderAppRoutes(['/'], createMockAuthForRole('PLATFORM_ADMIN'))

    await waitFor(() => {
      expect(screen.getByTestId('admin-shell')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Organizations' })).toBeInTheDocument()
    })
    expect(screen.queryByTestId('org-shell')).not.toBeInTheDocument()
  })

  it('redirects employee from settings route', async () => {
    renderAppRoutes(['/settings'], createMockAuthForRole('EMPLOYEE'))

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
    })
    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('redirects employee from approvals route', async () => {
    renderAppRoutes(['/approvals'], createMockAuthForRole('EMPLOYEE'))

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
    })
    expect(screen.queryByRole('heading', { name: 'Approvals' })).not.toBeInTheDocument()
  })

  it('redirects manager from settings route', async () => {
    renderAppRoutes(['/settings'], createMockAuthForRole('MANAGER'))

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
    })
    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('allows HR admin to open settings route', async () => {
    renderAppRoutes(['/settings'], createMockAuthForRole('HR_ADMIN'))

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByTestId('nav-settings')).toBeInTheDocument()
  })

  it('renders the real Team Calendar page at /calendar', async () => {
    renderAppRoutes(['/calendar'], createMockAuthForRole('EMPLOYEE'))

    // Lazy page chunk + month reconciliation refetch can exceed the default 1s
    // findBy timeout under parallel test load.
    expect(
      await screen.findByTestId('team-calendar-page', undefined, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByTestId('calendar-month-grid', undefined, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Org-wide leave coverage')).not.toBeInTheDocument()
  })

  it('renders org shell Page Not Found for unknown routes when authenticated', () => {
    renderAppRoutes(['/unknown-page'], createMockAuthForRole('EMPLOYEE'))

    expect(screen.getByTestId('org-shell')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Page Not Found' })).toBeInTheDocument()
  })

  it('renders admin shell Page Not Found for unknown platform routes when authenticated', () => {
    renderAppRoutes(['/platform/unknown'], createMockAuthForRole('PLATFORM_ADMIN'))

    expect(screen.getByTestId('admin-shell')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Page Not Found' })).toBeInTheDocument()
  })
})
