import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DashboardPlaceholder } from '../../features/dashboard/DashboardPlaceholder'
import {
  AuthTestProvider,
  createMockAuthForRole,
  createMockAuthValue,
} from '../../test/authTestUtils'
import { OrgShell } from './OrgShell'

function renderOrgShell(role: Parameters<typeof createMockAuthForRole>[0]) {
  render(
    <MemoryRouter initialEntries={['/']}>
      <AuthTestProvider value={createMockAuthForRole(role)}>
        <Routes>
          <Route element={<OrgShell />}>
            <Route path="/" element={<DashboardPlaceholder />} />
          </Route>
        </Routes>
      </AuthTestProvider>
    </MemoryRouter>,
  )
}

describe('OrgShell', () => {
  it('renders teal sidebar and page title typography', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthTestProvider>
          <Routes>
            <Route element={<OrgShell />}>
              <Route path="/" element={<DashboardPlaceholder />} />
            </Route>
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>,
    )

    const sidebar = screen.getByTestId('sidebar')
    expect(sidebar).toHaveClass('sidebar', 'sidebar--org')
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()

    const pageTitle = screen.getByRole('heading', { name: 'Dashboard' })
    expect(pageTitle).toHaveClass('page-title')
  })

  it('shows only base nav items for EMPLOYEE', () => {
    renderOrgShell('EMPLOYEE')

    expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('nav-my-leaves')).toBeInTheDocument()
    expect(screen.getByTestId('nav-calendar')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-approvals')).not.toBeInTheDocument()
    expect(screen.queryByTestId('nav-settings')).not.toBeInTheDocument()
  })

  it('shows Approvals for MANAGER without Settings', () => {
    renderOrgShell('MANAGER')

    expect(screen.getByTestId('nav-approvals')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-settings')).not.toBeInTheDocument()
  })

  it('shows Approvals and Settings for HR_ADMIN', () => {
    renderOrgShell('HR_ADMIN')

    expect(screen.getByTestId('nav-approvals')).toBeInTheDocument()
    expect(screen.getByTestId('nav-settings')).toBeInTheDocument()
  })

  it('shows no org nav items for PLATFORM_ADMIN fallback role', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthTestProvider value={createMockAuthForRole('PLATFORM_ADMIN')}>
          <Routes>
            <Route element={<OrgShell />}>
              <Route path="/" element={<DashboardPlaceholder />} />
            </Route>
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>,
    )

    expect(screen.queryByTestId('nav-dashboard')).not.toBeInTheDocument()
    expect(screen.queryByTestId('nav-approvals')).not.toBeInTheDocument()
  })
})
