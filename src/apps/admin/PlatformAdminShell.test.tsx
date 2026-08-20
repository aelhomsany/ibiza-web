import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { ToastProvider } from '../../components/ui/ToastProvider'
import {
  PlatformAuthContext,
  type PlatformAuthContextValue,
} from '../../features/platform-auth/usePlatformAuth'
import { PlatformAdminShell } from './PlatformAdminShell'

function renderShell(fullName = 'Riley Morgan') {
  const logout = vi.fn().mockResolvedValue(undefined)
  const value: PlatformAuthContextValue = {
    user: {
      id: 1,
      email: 'riley@ibiza.test',
      fullName,
      role: 'PLATFORM_ADMIN',
      preferredLanguage: 'en',
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout,
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/app-admin/organizations']}>
          <PlatformAuthContext.Provider value={value}>
            <Routes>
              <Route element={<PlatformAdminShell />}>
                <Route path="/app-admin/organizations" element={<div>Organizations stub</div>} />
              </Route>
            </Routes>
          </PlatformAuthContext.Provider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { logout }
}

describe('PlatformAdminShell', () => {
  it('[P1] renders the user menu with a profile link and sign-out', async () => {
    renderShell()

    await userEvent.click(screen.getByTestId('user-menu-trigger'))

    expect(screen.getByTestId('user-menu-item-profile')).toHaveAttribute(
      'href',
      '/app-admin/profile',
    )
    expect(screen.getByTestId('user-menu-item-sign-out')).toBeInTheDocument()
  })

  it('[P2] a long operator name stays truncatable with the full text in a title attribute', async () => {
    const longName = 'Aleksandra Konstantinopolitanova-Wetherbourne III'
    renderShell(longName)

    await userEvent.click(screen.getByTestId('user-menu-trigger'))

    // Ellipsis itself is CSS (text-overflow) and not assertable in jsdom; the title
    // attribute is the accessible half of UX-DR29 and is. Asserted on the menu's own
    // name element -- the surface this change introduced. The header contextLabel also
    // carries a title, but its value is "Operator access only · <name>", so an exact
    // getByTitle(longName) resolves only to the user-menu name.
    const menuName = screen.getByTitle(longName)
    expect(within(screen.getByTestId('user-menu-panel')).getByText(longName)).toBe(menuName)
    expect(menuName).toHaveTextContent(longName)
  })

  it('[P1] the language control exposes menuitemradio semantics with the active locale checked', async () => {
    renderShell()

    await userEvent.click(screen.getByTestId('user-menu-trigger'))

    const group = screen.getByTestId('platform-admin-language')
    const options = within(group).getAllByRole('menuitemradio')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveAccessibleName(/English/)
    expect(options[0]).toHaveAttribute('aria-checked', 'true')
    expect(options[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('[P1] the language control is reachable inside the menu at every viewport', async () => {
    renderShell()

    await userEvent.click(screen.getByTestId('user-menu-trigger'))

    // Regression guard: the control used to carry a <=900px display:none rule from
    // its old life as a header-bar element, which hid it inside the panel that exists
    // to be its mobile home. jsdom applies no media queries, so this pins containment
    // rather than computed visibility -- the viewport half belongs to Playwright.
    const panel = screen.getByTestId('user-menu-panel')
    expect(panel).toContainElement(screen.getByTestId('platform-admin-language'))
  })

  it('[P1] sign-out still terminates the platform session after absorption into the menu', async () => {
    const { logout } = renderShell()

    await userEvent.click(screen.getByTestId('user-menu-trigger'))
    await userEvent.click(screen.getByTestId('user-menu-item-sign-out'))

    expect(logout).toHaveBeenCalledTimes(1)
  })
})
