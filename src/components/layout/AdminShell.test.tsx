import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { OrganizationsPage } from '../../features/platform/OrganizationsPage'
import { AuthTestProvider, createMockAuthForRole, createMockAuthValue, mockUsers } from '../../test/authTestUtils'
import { ToastProvider } from '../ui/ToastProvider'
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
        <ToastProvider>
          <MemoryRouter initialEntries={['/platform/organizations']}>
            <AuthTestProvider value={createMockAuthForRole('PLATFORM_ADMIN')}>
              <Routes>
                <Route element={<AdminShell />}>
                  <Route path="/platform/organizations" element={<OrganizationsPage />} />
                </Route>
              </Routes>
            </AuthTestProvider>
          </MemoryRouter>
        </ToastProvider>
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
    expect(screen.getByTestId('language-switcher')).toBeInTheDocument()
    expect(screen.getByTestId('user-menu-trigger')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create organization/i })).toHaveClass(
      'btn-admin',
    )
  })

  it('[P0] removes sidebar sign-out and shows admin user menu without org-only items', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/platform/organizations']}>
            <AuthTestProvider value={createMockAuthForRole('PLATFORM_ADMIN')}>
              <Routes>
                <Route element={<AdminShell />}>
                  <Route path="/platform/organizations" element={<OrganizationsPage />} />
                </Route>
              </Routes>
            </AuthTestProvider>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    )

    const sidebar = screen.getByTestId('sidebar')
    expect(within(sidebar).queryByTestId('sign-out-button')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('user-menu-trigger'))
    expect(screen.getByTestId('user-menu-item-profile')).toBeInTheDocument()
    expect(screen.queryByTestId('user-menu-item-my-requests')).not.toBeInTheDocument()
    expect(screen.queryByTestId('user-menu-item-settings')).not.toBeInTheDocument()
    expect(screen.getByTestId('user-menu-item-sign-out')).toBeInTheDocument()
  })

  it('[P0] shows profile image in the admin header avatar when profileImageUrl is present', async () => {
    vi.spyOn(apiClient, 'getProfileImageContent').mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:profile'), revokeObjectURL: vi.fn() })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/platform/organizations']}>
            <AuthTestProvider
              value={createMockAuthValue({
                user: {
                  ...mockUsers.platformAdmin,
                  profileImageUrl: '/api/v1/users/me/profile-image/content?v=2',
                },
              })}
            >
              <Routes>
                <Route element={<AdminShell />}>
                  <Route path="/platform/organizations" element={<OrganizationsPage />} />
                </Route>
              </Routes>
            </AuthTestProvider>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('user-menu-trigger').querySelector('img')).toBeInTheDocument()
    })
  })
})
