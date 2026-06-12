import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { AuthTestProvider, createMockAuthValue } from '../../test/authTestUtils'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  const login = vi.fn()

  beforeEach(() => {
    login.mockReset()
    login.mockResolvedValue({
      id: 1,
      email: 'alex@company.com',
      fullName: 'Alex Pilot',
      role: 'EMPLOYEE',
      organizationId: 1,
      timezone: 'America/New_York',
    })
  })

  it('renders sign-in form test ids', () => {
    render(
      <MemoryRouter>
        <AuthTestProvider
          value={createMockAuthValue({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            login,
          })}
        >
          <LoginPage />
        </AuthTestProvider>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('sign-in-email')).toBeInTheDocument()
    expect(screen.getByTestId('sign-in-password')).toBeInTheDocument()
    expect(screen.getByTestId('sign-in-submit')).toBeInTheDocument()
  })

  it('redirects authenticated user to role-appropriate home', () => {
    render(
      <MemoryRouter>
        <AuthTestProvider
          value={createMockAuthValue({
            user: {
              id: 1,
              email: 'alex@company.com',
              fullName: 'Alex Pilot',
              role: 'EMPLOYEE',
              organizationId: 1,
              timezone: 'America/New_York',
            },
            isAuthenticated: true,
            isLoading: false,
          })}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('redirects PLATFORM_ADMIN to /platform/organizations', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthTestProvider
          value={createMockAuthValue({
            user: {
              id: 2,
              email: 'admin@ibiza.app',
              fullName: 'Platform Admin',
              role: 'PLATFORM_ADMIN',
              organizationId: 1,
              timezone: 'UTC',
            },
            isAuthenticated: true,
            isLoading: false,
          })}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/platform/organizations" element={<div data-testid="admin-home">Admin</div>} />
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('admin-home')).toBeInTheDocument()
  })

  it('submits credentials via login and shows API error message', async () => {
    const user = userEvent.setup()
    login.mockRejectedValue(
      new ApiError(401, {
        status: 401,
        detail: 'Invalid email or password',
      }),
    )

    render(
      <MemoryRouter>
        <AuthTestProvider
          value={createMockAuthValue({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            login,
          })}
        >
          <LoginPage />
        </AuthTestProvider>
      </MemoryRouter>,
    )

    await user.type(screen.getByTestId('sign-in-email'), 'alex@company.com')
    await user.type(screen.getByTestId('sign-in-password'), 'wrong')
    await user.click(screen.getByTestId('sign-in-submit'))

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('alex@company.com', 'wrong')
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password')
  })
})
