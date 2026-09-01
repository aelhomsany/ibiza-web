import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import { AuthTestProvider, createMockAuthForRole } from '../test/authTestUtils'
import * as apiClient from '../api/client'
import { RoleGuard } from './RoleGuard'

function renderGuard(
  initialPath: string,
  role: Parameters<typeof createMockAuthForRole>[0],
  guardProps: ComponentProps<typeof RoleGuard>,
  serverCapability = role === 'MANAGER' || role === 'HR_ADMIN',
) {
  vi.mocked(apiClient.getApprovalCapability).mockResolvedValue({
    canReviewApprovals: serverCapability,
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthTestProvider value={createMockAuthForRole(role)}>
          <Routes>
          {/* getHomePath returns /calendar since the Dashboard merge (2026-09-01). */}
          <Route path="/calendar" element={<div data-testid="home-page">Home</div>} />
          <Route path="/login" element={<div data-testid="login-page">Sign in</div>} />
          <Route element={<RoleGuard {...guardProps} />}>
            <Route path="/protected" element={<div data-testid="protected-page">Protected</div>} />
            <Route
              path="/approvals"
              element={<div data-testid="approvals-page">Approvals</div>}
            />
            <Route path="/settings" element={<div data-testid="settings-page">Settings</div>} />
          </Route>
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('RoleGuard', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getApprovalCapability')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
  it('renders child route when shell org and user is org role', () => {
    renderGuard('/protected', 'EMPLOYEE', { shell: 'org' })
    expect(screen.getByTestId('protected-page')).toBeInTheDocument()
  })

  it('redirects PLATFORM_ADMIN out of the org shell to customer sign-in', () => {
    // The customer artifact serves no operator route since Story 12.1; the only
    // terminal destination left for this role is the customer sign-in form.
    renderGuard('/protected', 'PLATFORM_ADMIN', { shell: 'org' })
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument()
  })

  it('redirects EMPLOYEE from approvals route', () => {
    renderGuard('/approvals', 'EMPLOYEE', { allowedRoles: ['MANAGER', 'HR_ADMIN'] })
    expect(screen.getByTestId('home-page')).toBeInTheDocument()
    expect(screen.queryByTestId('approvals-page')).not.toBeInTheDocument()
  })

  it('allows MANAGER on approvals route', () => {
    renderGuard('/approvals', 'MANAGER', { allowedRoles: ['MANAGER', 'HR_ADMIN'] })
    expect(screen.getByTestId('approvals-page')).toBeInTheDocument()
  })

  it('redirects MANAGER from settings route', () => {
    renderGuard('/settings', 'MANAGER', { allowedRoles: ['HR_ADMIN'] })
    expect(screen.getByTestId('home-page')).toBeInTheDocument()
    expect(screen.queryByTestId('settings-page')).not.toBeInTheDocument()
  })

  it('allows HR_ADMIN on settings route', () => {
    renderGuard('/settings', 'HR_ADMIN', { allowedRoles: ['HR_ADMIN'] })
    expect(screen.getByTestId('settings-page')).toBeInTheDocument()
  })

  describe('shell org — canAccessOrgRoute enforcement', () => {
    it('redirects EMPLOYEE from /approvals via canAccessOrgRoute', async () => {
      renderGuard('/approvals', 'EMPLOYEE', { shell: 'org' })
      expect(await screen.findByTestId('home-page')).toBeInTheDocument()
      expect(screen.queryByTestId('approvals-page')).not.toBeInTheDocument()
    })

    it('allows an assigned EMPLOYEE after the live capability check', async () => {
      renderGuard('/approvals', 'EMPLOYEE', { shell: 'org' }, true)
      expect(await screen.findByTestId('approvals-page')).toBeInTheDocument()
    })

    it('allows MANAGER on /approvals via canAccessOrgRoute', async () => {
      renderGuard('/approvals', 'MANAGER', { shell: 'org' })
      expect(await screen.findByTestId('approvals-page')).toBeInTheDocument()
    })

    it('does not render approvals content while a stale-true capability guess is still resolving', () => {
      // Regression guard: an optimistic "true" guess (cached/role heuristic) must not let
      // the Approvals route render before the live capability check actually resolves.
      renderGuard('/approvals', 'MANAGER', { shell: 'org' }, false)
      expect(screen.queryByTestId('approvals-page')).not.toBeInTheDocument()
      expect(screen.getByTestId('approval-capability-loading')).toBeInTheDocument()
    })

    it('redirects MANAGER from /settings via canAccessOrgRoute', () => {
      renderGuard('/settings', 'MANAGER', { shell: 'org' })
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
      expect(screen.queryByTestId('settings-page')).not.toBeInTheDocument()
    })

    it('allows HR_ADMIN on /settings via canAccessOrgRoute', () => {
      renderGuard('/settings', 'HR_ADMIN', { shell: 'org' })
      expect(screen.getByTestId('settings-page')).toBeInTheDocument()
    })

    it('allows EMPLOYEE on unrestricted org routes (/my-leaves)', () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      vi.mocked(apiClient.getApprovalCapability).mockResolvedValue({ canReviewApprovals: false })
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/my-leaves']}>
            <AuthTestProvider value={createMockAuthForRole('EMPLOYEE')}>
              <Routes>
              <Route path="/" element={<div data-testid="home-page">Home</div>} />
              <Route element={<RoleGuard shell="org" />}>
                <Route path="/my-leaves" element={<div data-testid="my-leaves-page">My Leaves</div>} />
              </Route>
              </Routes>
            </AuthTestProvider>
          </MemoryRouter>
        </QueryClientProvider>,
      )
      expect(screen.getByTestId('my-leaves-page')).toBeInTheDocument()
    })
  })
})
