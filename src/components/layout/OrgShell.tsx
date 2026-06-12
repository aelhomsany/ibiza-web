import { Outlet } from 'react-router-dom'
import { getOrgNavItems } from '../../auth/rolePermissions'
import { useAuth } from '../../auth/useAuth'
import { Sidebar } from './Sidebar'
import './org-shell.css'

export function OrgShell() {
  const { user, logout } = useAuth()
  const navItems = getOrgNavItems(user?.role ?? 'EMPLOYEE')

  return (
    <div className="org-shell" data-testid="org-shell">
      <Sidebar
        variant="org"
        navItems={navItems}
        userName={user?.fullName ?? 'User'}
        userRole={user?.role ?? 'EMPLOYEE'}
        onSignOut={logout}
      />
      <main className="org-shell__main">
        <Outlet />
      </main>
    </div>
  )
}
