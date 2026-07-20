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

/**
 * Story 10.10 — UXA-11 skip-to-main in AdminShell (behavioral keyboard contract).
 */
describe('AdminShell accessibility ATDD — Story 10.10', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getPlatformOrganizations').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test(
    '[P0] exposes skip-to-main as the first Tab stop and targets #main-content',
    async () => {
      const user = userEvent.setup()
      renderAdminShell()

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
      renderAdminShell()

      await user.tab()
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(document.getElementById('main-content')).toHaveFocus()
      })
    },
  )
})
