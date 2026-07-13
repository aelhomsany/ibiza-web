import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../api/client'
import type { AuthContextValue } from '../auth/useAuth'
import { AuthTestProvider, createMockAuthForRole } from '../test/authTestUtils'
import { mockCalendarMonth } from '../features/calendar/calendarTestFixtures'
import { AppRoutes } from './AppRouter'
import { ToastProvider } from '../components/ui/ToastProvider'

vi.mock('../features/dashboard/DashboardPage', () => ({
  DashboardPage: () => {
    throw new Error('simulated dashboard render failure')
  },
}))

vi.mock('../features/platform/OrganizationsPage', () => ({
  OrganizationsPage: () => {
    throw new Error('simulated organizations render failure')
  },
}))

function renderAppRoutes(
  initialEntries = ['/'],
  authValue: AuthContextValue = createMockAuthForRole('EMPLOYEE'),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <AuthTestProvider value={authValue}>
            <AppRoutes />
          </AuthTestProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('AppRouter route-level error boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-06-15T12:00:00Z') })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      { id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] },
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

  it('catches lazy route render errors inside the org shell and keeps chrome interactive', async () => {
    renderAppRoutes()

    expect(await screen.findByTestId('route-error-fallback')).toBeInTheDocument()
    expect(screen.getByTestId('org-shell')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('catches lazy route render errors inside the admin shell and keeps chrome interactive', async () => {
    renderAppRoutes(['/platform/organizations'], createMockAuthForRole('PLATFORM_ADMIN'))

    expect(await screen.findByTestId('route-error-fallback')).toBeInTheDocument()
    expect(screen.getByTestId('admin-shell')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.getByTestId('nav-organizations')).toBeInTheDocument()
  })
})
