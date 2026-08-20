import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../api/client'
import { ToastProvider } from '../../components/ui/ToastProvider'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { CustomerRoutes } from './CustomerRouter'

/**
 * FRONTEND-VAL-001 anchored on the router the customer artifact ships.
 *
 * The requirement was previously proven only by `routes/AppRouter.error-boundary.test.tsx`.
 * `routes/AppRouter.tsx` is imported by its own test files and nothing else — `app.html`
 * loads `src/entries/customer-main.tsx`, which mounts `CustomerRouter`. The route-level
 * boundary itself lives in `OrgShell` (`ErrorBoundary variant="route"`, keyed on pathname),
 * which `CustomerRouter` mounts, so the behavior is real in the shipped bundle; only the
 * proof was pointed at a module that ships nowhere.
 */
vi.mock('../../features/dashboard/DashboardPage', () => ({
  DashboardPage: () => {
    throw new Error('simulated dashboard render failure')
  },
}))

describe('CustomerRoutes error boundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue([])
  })

  afterEach(() => {
    document.title = ''
    vi.restoreAllMocks()
  })

  it('[P0] catches a lazy route render error inside the org shell and keeps chrome interactive', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/']}>
            <AuthTestProvider value={createMockAuthForRole('EMPLOYEE')}>
              <CustomerRoutes />
            </AuthTestProvider>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    )

    expect(await screen.findByTestId('route-error-fallback')).toBeInTheDocument()
    // Chrome survives the route-level failure: the shell and its navigation stay mounted.
    expect(screen.getByTestId('org-shell')).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
