import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../api/client'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

vi.mock('./timezone', () => ({
  getBrowserTimezone: vi.fn(() => 'Europe/Berlin'),
}))

vi.mock('../api/client', () => ({
  getMe: vi.fn(),
  postLogin: vi.fn(),
  postLogout: vi.fn(),
  postRefresh: vi.fn(),
  setAuthFailureHandler: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

const mockUser = {
  id: 1,
  email: 'alex@company.com',
  fullName: 'Alex Pilot',
  role: 'EMPLOYEE' as const,
  organizationId: 1,
  timezone: 'Europe/Berlin',
}

function LogoutProbe() {
  const { logout, isAuthenticated } = useAuth()
  return (
    <div>
      <span data-testid="auth-state">{isAuthenticated ? 'in' : 'out'}</span>
      <button type="button" onClick={() => void logout()}>
        Logout
      </button>
    </div>
  )
}

function renderAuthProvider(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        <LogoutProbe />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.postRefresh).mockRejectedValue(new Error('no session'))
  })

  it('restoreSession calls refresh on mount and ends loading when refresh fails', async () => {
    renderAuthProvider()

    await waitFor(() => {
      expect(apiClient.postRefresh).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('out')
    })
  })

  it('restoreSession loads user when refresh succeeds', async () => {
    vi.mocked(apiClient.postRefresh).mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 900,
    })
    vi.mocked(apiClient.getMe).mockResolvedValue(mockUser)

    renderAuthProvider()

    await waitFor(() => {
      expect(apiClient.getMe).toHaveBeenCalledTimes(1)
    })
  })

  it('login sets user state on success', async () => {
    vi.mocked(apiClient.postLogin).mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 900,
    })
    vi.mocked(apiClient.getMe).mockResolvedValue(mockUser)

    function LoginProbe() {
      const { login, isAuthenticated } = useAuth()
      return (
        <div>
          <span data-testid="auth-state">{isAuthenticated ? 'in' : 'out'}</span>
          <button type="button" onClick={() => void login('alex@company.com', 'pass')}>
            Login
          </button>
        </div>
      )
    }

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginProbe />
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('out')
    })

    await user.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(apiClient.postLogin).toHaveBeenCalledWith({
        email: 'alex@company.com',
        password: 'pass',
        timezone: 'Europe/Berlin',
      })
      expect(screen.getByTestId('auth-state')).toHaveTextContent('in')
    })
  })

  it('logout calls postLogout and clears authenticated state', async () => {
    vi.mocked(apiClient.postRefresh).mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 900,
    })
    vi.mocked(apiClient.getMe).mockResolvedValue(mockUser)
    vi.mocked(apiClient.postLogout).mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderAuthProvider()

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('in')
    })

    await user.click(screen.getByRole('button', { name: 'Logout' }))

    await waitFor(() => {
      expect(apiClient.postLogout).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('auth-state')).toHaveTextContent('out')
    })
  })
})
