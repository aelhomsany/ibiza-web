import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { DashboardPage } from '../../features/dashboard/DashboardPage'
import {
  AuthTestProvider,
  createMockAuthForRole,
  createMockAuthValue,
} from '../../test/authTestUtils'
import { OrgShell } from './OrgShell'

function renderOrgShell(role: Parameters<typeof createMockAuthForRole>[0]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <AuthTestProvider value={createMockAuthForRole(role)}>
          <Routes>
            <Route element={<OrgShell />}>
              <Route path="/" element={<DashboardPage />} />
            </Route>
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('OrgShell', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders teal sidebar and dashboard greeting typography', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <AuthTestProvider>
            <Routes>
              <Route element={<OrgShell />}>
                <Route path="/" element={<DashboardPage />} />
              </Route>
            </Routes>
          </AuthTestProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const sidebar = screen.getByTestId('sidebar')
    expect(sidebar).toHaveClass('sidebar', 'sidebar--org')
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()

    const pageTitle = screen.getByRole('heading', { name: /Good (morning|afternoon|evening)/i })
    expect(pageTitle).toHaveClass('page-title')
  })

  it('shows only base nav items for EMPLOYEE', () => {
    renderOrgShell('EMPLOYEE')

    expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('nav-my-leaves')).toBeInTheDocument()
    expect(screen.getByTestId('nav-calendar')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-approvals')).not.toBeInTheDocument()
    expect(screen.queryByTestId('nav-settings')).not.toBeInTheDocument()
  })

  it('shows Approvals for MANAGER without Settings', () => {
    renderOrgShell('MANAGER')

    expect(screen.getByTestId('nav-approvals')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-settings')).not.toBeInTheDocument()
  })

  it('shows Approvals and Settings for HR_ADMIN', () => {
    renderOrgShell('HR_ADMIN')

    expect(screen.getByTestId('nav-approvals')).toBeInTheDocument()
    expect(screen.getByTestId('nav-settings')).toBeInTheDocument()
  })

  it('shows no org nav items for PLATFORM_ADMIN fallback role', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <AuthTestProvider value={createMockAuthForRole('PLATFORM_ADMIN')}>
            <Routes>
              <Route element={<OrgShell />}>
                <Route path="/" element={<DashboardPage />} />
              </Route>
            </Routes>
          </AuthTestProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.queryByTestId('nav-dashboard')).not.toBeInTheDocument()
    expect(screen.queryByTestId('nav-approvals')).not.toBeInTheDocument()
  })
})
