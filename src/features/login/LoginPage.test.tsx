import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import i18n from '../../i18n/config'
import { AuthTestProvider, createMockAuthValue } from '../../test/authTestUtils'
import { skipOnboardingRedirect } from '../onboarding/redirectPreference'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  const login = vi.fn()

  beforeEach(() => {
    window.localStorage.clear()
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

  afterEach(async () => {
    vi.unstubAllGlobals()
    if (i18n.language !== 'en') {
      await act(async () => {
        await i18n.changeLanguage('en')
      })
    }
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

  it('announces successful invitation acceptance from route state', () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/login', state: { invitationAccepted: true } },
        ]}
      >
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

    expect(screen.getByRole('status')).toHaveTextContent(
      'Invitation accepted. Sign in with your new password.',
    )
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

  // Story 12.1: operators sign in at /app-admin/login in the Admin artifact. The
  // customer app serves no operator route, so it must show the sign-in form rather
  // than redirect — bouncing to an org route would loop against RoleGuard.
  it('keeps a PLATFORM_ADMIN on the customer sign-in form instead of redirecting', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthTestProvider
          value={createMockAuthValue({
            user: {
              id: 2,
              email: 'riley@ibiza.app',
              fullName: 'Riley Morgan',
              role: 'PLATFORM_ADMIN',
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

    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-home')).not.toBeInTheDocument()
  })

  it.each([
    ['EMPLOYEE', '/', 'dashboard'],
  ] as const)(
    'routes a successful %s sign-in to the authorized home',
    async (role, destination, testId) => {
      const user = userEvent.setup()
      login.mockResolvedValue({
        id: role === 'PLATFORM_ADMIN' ? 2 : 1,
        email:
          role === 'PLATFORM_ADMIN'
            ? 'riley@ibiza.app'
            : 'alex@company.com',
        fullName: role === 'PLATFORM_ADMIN' ? 'Riley Morgan' : 'Alex Pilot',
        role,
        ...(role === 'PLATFORM_ADMIN'
          ? {}
          : {
              organizationId: 1,
              organizationName: 'Nile Harbor',
              timezone: 'America/New_York',
            }),
      })

      render(
        <MemoryRouter initialEntries={['/login']}>
          <AuthTestProvider
            value={createMockAuthValue({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              login,
            })}
          >
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path={destination}
                element={<div data-testid={testId}>Authorized home</div>}
              />
            </Routes>
          </AuthTestProvider>
        </MemoryRouter>,
      )

      await user.type(screen.getByTestId('sign-in-email'), 'person@example.com')
      await user.type(screen.getByTestId('sign-in-password'), 'Secret1!')
      await user.click(screen.getByTestId('sign-in-submit'))

      expect(await screen.findByTestId(testId)).toBeInTheDocument()
    },
  )

  it('resumes an enabled server onboarding workflow after HR admin sign-in', async () => {
    const user = userEvent.setup()
    login.mockResolvedValue({
      id: 7,
      email: 'hr@company.com',
      fullName: 'Harper Admin',
      role: 'HR_ADMIN',
      organizationId: 1,
      organizationName: 'Nile Harbor',
      timezone: 'America/New_York',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            presentationEnabled: true,
            activationStatus: 'NOT_ACTIVATED',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthTestProvider
          value={createMockAuthValue({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            login,
          })}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/onboarding" element={<div data-testid="guided-onboarding">Guided onboarding</div>} />
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>,
    )

    await user.type(screen.getByTestId('sign-in-email'), 'hr@company.com')
    await user.type(screen.getByTestId('sign-in-password'), 'Secret1!')
    await user.click(screen.getByTestId('sign-in-submit'))

    expect(await screen.findByTestId('guided-onboarding')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/onboarding',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('respects a persisted "Not now" instead of diverting the admin on every sign-in', async () => {
    const user = userEvent.setup()
    const hrAdmin = {
      id: 7,
      email: 'hr@company.com',
      fullName: 'Harper Admin',
      role: 'HR_ADMIN' as const,
      organizationId: 1,
      organizationName: 'Nile Harbor',
      timezone: 'America/New_York',
    }
    login.mockResolvedValue(hrAdmin)
    skipOnboardingRedirect(hrAdmin.id)
    vi.stubGlobal('fetch', vi.fn())

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthTestProvider
          value={createMockAuthValue({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            login,
          })}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
            <Route path="/onboarding" element={<div data-testid="guided-onboarding">Guided onboarding</div>} />
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>,
    )

    await user.type(screen.getByTestId('sign-in-email'), 'hr@company.com')
    await user.type(screen.getByTestId('sign-in-password'), 'Secret1!')
    await user.click(screen.getByTestId('sign-in-submit'))

    expect(await screen.findByTestId('dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('guided-onboarding')).not.toBeInTheDocument()
    // The opt-out short-circuits before the lookup — no reason to ask.
    expect(fetch).not.toHaveBeenCalled()
  })

  it('preserves the existing HR home when onboarding is unavailable', async () => {
    const user = userEvent.setup()
    login.mockResolvedValue({
      id: 7,
      email: 'hr@company.com',
      fullName: 'Harper Admin',
      role: 'HR_ADMIN',
      organizationId: 1,
      organizationName: 'Nile Harbor',
      timezone: 'America/New_York',
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthTestProvider
          value={createMockAuthValue({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            login,
          })}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<div data-testid="dashboard-fallback">Dashboard</div>} />
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>,
    )

    await user.type(screen.getByTestId('sign-in-email'), 'hr@company.com')
    await user.type(screen.getByTestId('sign-in-password'), 'Secret1!')
    await user.click(screen.getByTestId('sign-in-submit'))

    expect(await screen.findByTestId('dashboard-fallback')).toBeInTheDocument()
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

  it('renders authored Arabic proof and preserves chronological proof direction', async () => {
    await act(async () => {
      await i18n.changeLanguage('ar')
    })

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

    const proof = screen.getByTestId('auth-proof-panel')
    expect(proof).toHaveTextContent('اعرف بدقة تكلفة كل يوم')
    expect(
      screen.getByLabelText('التواريخ بترتيبها الزمني'),
    ).toHaveClass('auth-proof-days')
    expect(proof.querySelectorAll('bdi[dir="ltr"]').length).toBeGreaterThan(0)
  })
})
