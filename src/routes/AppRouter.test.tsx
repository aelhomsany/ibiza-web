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
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      { id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] },
      { id: 2, name: 'Egypt', weekendDays: ['FRIDAY', 'SATURDAY'] },
    ])
    vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([])
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue([])
  })

  afterEach(() => {
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

  it('renders org shell at root route when authenticated', () => {
    renderAppRoutes(['/'], createMockAuthForRole('EMPLOYEE'))

    expect(screen.getByTestId('org-shell')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
    expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument()
  })

  it('renders admin shell at platform route when authenticated as platform admin', () => {
    renderAppRoutes(['/platform/organizations'], createMockAuthForRole('PLATFORM_ADMIN'))

    expect(screen.getByTestId('admin-shell')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Organizations' })).toBeInTheDocument()
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

  it('allows HR admin to open settings route', () => {
    renderAppRoutes(['/settings'], createMockAuthForRole('HR_ADMIN'))

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByTestId('nav-settings')).toBeInTheDocument()
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
