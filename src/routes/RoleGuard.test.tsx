import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AuthTestProvider, createMockAuthForRole } from '../test/authTestUtils'
import { RoleGuard } from './RoleGuard'

function renderGuard(
  initialPath: string,
  role: Parameters<typeof createMockAuthForRole>[0],
  guardProps: ComponentProps<typeof RoleGuard>,
) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthTestProvider value={createMockAuthForRole(role)}>
        <Routes>
          <Route path="/" element={<div data-testid="home-page">Home</div>} />
          <Route
            path="/platform/organizations"
            element={<div data-testid="platform-home">Platform</div>}
          />
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
    </MemoryRouter>,
  )
}

describe('RoleGuard', () => {
  it('renders child route when shell org and user is org role', () => {
    renderGuard('/protected', 'EMPLOYEE', { shell: 'org' })
    expect(screen.getByTestId('protected-page')).toBeInTheDocument()
  })

  it('redirects PLATFORM_ADMIN away from org shell', () => {
    renderGuard('/protected', 'PLATFORM_ADMIN', { shell: 'org' })
    expect(screen.getByTestId('platform-home')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument()
  })

  it('redirects org roles away from admin shell', () => {
    renderGuard('/protected', 'MANAGER', { shell: 'admin' })
    expect(screen.getByTestId('home-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument()
  })

  it('allows PLATFORM_ADMIN in admin shell', () => {
    render(
      <MemoryRouter initialEntries={['/platform/organizations']}>
        <AuthTestProvider value={createMockAuthForRole('PLATFORM_ADMIN')}>
          <Routes>
            <Route element={<RoleGuard shell="admin" />}>
              <Route
                path="/platform/organizations"
                element={<div data-testid="platform-home">Platform</div>}
              />
            </Route>
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('platform-home')).toBeInTheDocument()
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
    it('redirects EMPLOYEE from /approvals via canAccessOrgRoute', () => {
      renderGuard('/approvals', 'EMPLOYEE', { shell: 'org' })
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
      expect(screen.queryByTestId('approvals-page')).not.toBeInTheDocument()
    })

    it('allows MANAGER on /approvals via canAccessOrgRoute', () => {
      renderGuard('/approvals', 'MANAGER', { shell: 'org' })
      expect(screen.getByTestId('approvals-page')).toBeInTheDocument()
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
      render(
        <MemoryRouter initialEntries={['/my-leaves']}>
          <AuthTestProvider value={createMockAuthForRole('EMPLOYEE')}>
            <Routes>
              <Route path="/" element={<div data-testid="home-page">Home</div>} />
              <Route element={<RoleGuard shell="org" />}>
                <Route path="/my-leaves" element={<div data-testid="my-leaves-page">My Leaves</div>} />
              </Route>
            </Routes>
          </AuthTestProvider>
        </MemoryRouter>,
      )
      expect(screen.getByTestId('my-leaves-page')).toBeInTheDocument()
    })
  })
})
