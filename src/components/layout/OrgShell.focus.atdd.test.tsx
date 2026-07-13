import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import * as apiClient from '../../api/client'
import { DashboardPage } from '../../features/dashboard/DashboardPage'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { ToastProvider } from '../ui/ToastProvider'
import { OrgShell } from './OrgShell'

function renderOrgShell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/']}>
          <AuthTestProvider value={createMockAuthForRole('EMPLOYEE')}>
            <Routes>
              <Route element={<OrgShell />}>
                <Route path="/" element={<DashboardPage />} />
              </Route>
            </Routes>
          </AuthTestProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('OrgShell ATDD — Story 10.7 mobile drawer focus and inert', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue([])
    vi.spyOn(apiClient, 'getPendingApprovalCount').mockResolvedValue({ count: 0 })
    vi.spyOn(apiClient, 'getUnreadNotificationCount').mockResolvedValue({ count: 0 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('[P0] marks main content inert while the mobile drawer is open', async () => {
    const user = userEvent.setup()
    renderOrgShell()

    await user.click(screen.getByTestId('shell-topbar-menu'))

    const main = document.querySelector('.org-shell__main')
    expect(main).toHaveAttribute('inert')
  })

  test('[P0] focuses the first sidebar nav link when the mobile drawer opens', async () => {
    const user = userEvent.setup()
    renderOrgShell()

    await user.click(screen.getByTestId('shell-topbar-menu'))

    await waitFor(() => {
      expect(screen.getByTestId('nav-dashboard')).toHaveFocus()
    })
  })

  test('[P0] returns focus to the hamburger and removes inert when the drawer closes', async () => {
    const user = userEvent.setup()
    renderOrgShell()

    const menu = screen.getByTestId('shell-topbar-menu')
    await user.click(menu)
    await screen.findByTestId('sidebar')

    await user.click(screen.getByTestId('sidebar-backdrop'))

    await waitFor(() => {
      expect(menu).toHaveFocus()
      expect(document.querySelector('.org-shell__main')).not.toHaveAttribute('inert')
    })
  })

  test('[P0] closes through the hamburger while the main content is inert', async () => {
    const user = userEvent.setup()
    renderOrgShell()

    const menu = screen.getByTestId('shell-topbar-menu')
    await user.click(menu)
    expect(document.querySelector('.org-shell__main')).toHaveAttribute('inert')

    await user.click(menu)

    await waitFor(() => {
      expect(menu).toHaveFocus()
      expect(document.querySelector('.org-shell__main')).not.toHaveAttribute('inert')
    })
  })

  test('[P0] returns focus to the hamburger when the drawer closes via Escape', async () => {
    const user = userEvent.setup()
    renderOrgShell()

    const menu = screen.getByTestId('shell-topbar-menu')
    await user.click(menu)
    await screen.findByTestId('sidebar')

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(menu).toHaveFocus()
      expect(document.querySelector('.org-shell__main')).not.toHaveAttribute('inert')
    })
  })

  test('[P1] clears the drawer and inert state when the viewport widens to desktop', async () => {
    const originalInnerWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })

    try {
      const user = userEvent.setup()
      renderOrgShell()
      await user.click(screen.getByTestId('shell-topbar-menu'))
      expect(document.querySelector('.org-shell__main')).toHaveAttribute('inert')

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 901 })
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })

      await waitFor(() => {
        expect(document.querySelector('.org-shell__main')).not.toHaveAttribute('inert')
      })
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth })
    }
  })
})
