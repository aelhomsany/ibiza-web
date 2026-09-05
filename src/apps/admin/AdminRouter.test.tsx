import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, vi } from 'vitest'
import {
  PlatformAuthContext,
  type PlatformAuthContextValue,
} from '../../features/platform-auth/usePlatformAuth'
import { ToastProvider } from '../../components/ui/ToastProvider'
import { AdminRoutes } from './AdminRouter'

function signedInOperator(): PlatformAuthContextValue {
  return {
    user: {
      id: 1,
      email: 'riley@leaveo.example',
      fullName: 'Riley Morgan',
      role: 'PLATFORM_ADMIN',
      preferredLanguage: 'en',
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }
}

function renderAt(path: string, auth: PlatformAuthContextValue = signedInOperator()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <PlatformAuthContext.Provider value={auth}>
            <AdminRoutes />
          </PlatformAuthContext.Provider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('AdminRoutes', () => {
  beforeEach(() => {
    document.title = ''
  })

  it('[P0] renders the operator profile at /app-admin/profile', async () => {
    renderAt('/app-admin/profile')

    expect(await screen.findByTestId('platform-profile-page')).toBeInTheDocument()
  })

  it('[P2] sets the operator profile document title', async () => {
    renderAt('/app-admin/profile')

    await screen.findByTestId('platform-profile-page')
    expect(document.title).toBe('Operator Profile | Platform Admin | Ibiza')
  })

  it('[P1] redirects a signed-out operator away from the profile route', async () => {
    renderAt('/app-admin/profile', {
      ...signedInOperator(),
      user: null,
      isAuthenticated: false,
    })

    expect(await screen.findByTestId('platform-login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('platform-profile-page')).not.toBeInTheDocument()
  })
})
