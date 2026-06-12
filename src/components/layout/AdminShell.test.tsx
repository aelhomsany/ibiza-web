import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { OrganizationsPlaceholder } from '../../features/platform/OrganizationsPlaceholder'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { AdminShell } from './AdminShell'

describe('AdminShell', () => {
  it('renders admin shell with Organizations navigation only', () => {
    render(
      <MemoryRouter initialEntries={['/platform']}>
        <AuthTestProvider value={createMockAuthForRole('PLATFORM_ADMIN')}>
          <Routes>
            <Route element={<AdminShell />}>
              <Route path="/platform" element={<OrganizationsPlaceholder />} />
            </Route>
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>,
    )

    const shell = screen.getByTestId('admin-shell')
    expect(shell).toBeInTheDocument()

    const sidebar = screen.getByTestId('sidebar')
    expect(sidebar).toHaveClass('sidebar--admin')

    expect(screen.getByRole('link', { name: /organizations/i })).toBeInTheDocument()
    expect(screen.queryByTestId('nav-approvals')).not.toBeInTheDocument()
    expect(screen.queryByTestId('nav-settings')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create organization/i })).toHaveClass(
      'btn-admin',
    )
  })
})
