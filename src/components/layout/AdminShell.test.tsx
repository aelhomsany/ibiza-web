import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { OrganizationsPage } from '../../features/platform/OrganizationsPage'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { AdminShell } from './AdminShell'

describe('AdminShell', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getPlatformOrganizations').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders admin shell with Organizations navigation only', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/platform/organizations']}>
          <AuthTestProvider value={createMockAuthForRole('PLATFORM_ADMIN')}>
            <Routes>
              <Route element={<AdminShell />}>
                <Route path="/platform/organizations" element={<OrganizationsPage />} />
              </Route>
            </Routes>
          </AuthTestProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const shell = screen.getByTestId('admin-shell')
    expect(shell).toBeInTheDocument()

    const sidebar = screen.getByTestId('sidebar')
    expect(sidebar).toHaveClass('sidebar--admin')

    // 'Ibiza Admin' appears in both the sidebar logo and the app header brand.
    expect(within(sidebar).getByText('Ibiza Admin')).toBeInTheDocument()
    expect(within(sidebar).getByText('Platform Console')).toBeInTheDocument()
    expect(screen.getByTestId('app-header-context')).toHaveTextContent('Platform Admin')
    expect(screen.getByRole('link', { name: /organizations/i })).toBeInTheDocument()
    expect(screen.queryByTestId('nav-approvals')).not.toBeInTheDocument()
    expect(screen.queryByTestId('nav-settings')).not.toBeInTheDocument()
    expect(screen.queryByTestId('notification-bell')).not.toBeInTheDocument() // [P2] Platform Admin omits bell
    expect(screen.getByRole('button', { name: /create organization/i })).toHaveClass(
      'btn-admin',
    )
  })
})
