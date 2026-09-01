import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import * as apiClient from '../../api/client'
import { MyLeavesPage } from '../../features/my-leaves/MyLeavesPage'
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
                <Route path="/" element={<MyLeavesPage />} />
              </Route>
            </Routes>
          </AuthTestProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

/**
 * Story 10.10 — UXA-11 skip-to-main (behavioral keyboard contract).
 * SkipToMainLink behavioral keyboard contract.
 */
describe('OrgShell accessibility ATDD — Story 10.10', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue([])
    vi.spyOn(apiClient, 'getMyLeaveRequests').mockResolvedValue([])
    vi.spyOn(apiClient, 'getDashboardOutToday').mockResolvedValue([])
    vi.spyOn(apiClient, 'getDashboardUpcoming').mockResolvedValue([])
    vi.spyOn(apiClient, 'getApprovalCapability').mockResolvedValue({
      canReviewApprovals: false,
    })
    vi.spyOn(apiClient, 'getPendingApprovalCount').mockResolvedValue({ count: 0 })
    vi.spyOn(apiClient, 'getUnreadNotificationCount').mockResolvedValue({ count: 0 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test(
    '[P0] exposes skip-to-main as the first Tab stop and targets #main-content',
    async () => {
      const user = userEvent.setup()
      renderOrgShell()

      await user.tab()

      const skipLink = screen.getByRole('link', { name: /skip to main/i })
      expect(skipLink).toHaveFocus()
      expect(skipLink).toHaveAttribute('href', '#main-content')

      const main = document.getElementById('main-content')
      expect(main).toBeTruthy()
      expect(main).toHaveAttribute('tabindex', '-1')
    },
  )

  test(
    '[P0] moves focus into main content when the skip link is activated',
    async () => {
      const user = userEvent.setup()
      renderOrgShell()

      await user.tab()
      const skipLink = screen.getByRole('link', { name: /skip to main/i })
      expect(skipLink).toHaveFocus()

      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(document.getElementById('main-content')).toHaveFocus()
      })
    },
  )
})
