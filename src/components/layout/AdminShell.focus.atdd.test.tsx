import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import * as apiClient from '../../api/client'
import { OrganizationsPage } from '../../features/platform/OrganizationsPage'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { ToastProvider } from '../ui/ToastProvider'
import { AdminShell } from './AdminShell'

function renderAdminShell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
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
}

describe('AdminShell ATDD — Story 10.7 mobile drawer focus and inert', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getPlatformOrganizations').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('[P0] marks main content inert while the mobile drawer is open', async () => {
    const user = userEvent.setup()
    renderAdminShell()

    await user.click(screen.getByTestId('shell-topbar-menu'))

    const main = document.querySelector('.admin-shell__main')
    expect(main).toHaveAttribute('inert')
  })

  test('[P0] focuses the first sidebar nav link when the mobile drawer opens', async () => {
    const user = userEvent.setup()
    renderAdminShell()

    await user.click(screen.getByTestId('shell-topbar-menu'))

    await waitFor(() => {
      expect(screen.getByTestId('nav-organizations')).toHaveFocus()
    })
  })

  test('[P0] returns focus to the hamburger when the drawer closes via backdrop click', async () => {
    const user = userEvent.setup()
    renderAdminShell()

    const menu = screen.getByTestId('shell-topbar-menu')
    await user.click(menu)
    await screen.findByTestId('sidebar')

    await user.click(screen.getByTestId('sidebar-backdrop'))

    await waitFor(() => {
      expect(menu).toHaveFocus()
      expect(document.querySelector('.admin-shell__main')).not.toHaveAttribute('inert')
    })
  })
})
