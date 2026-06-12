import { Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { Sidebar, type NavItem } from './Sidebar'
import './admin-shell.css'

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Organizations', path: '/platform', icon: '🏢', end: true },
]

export function AdminShell() {
  const { user, logout } = useAuth()

  return (
    <div className="admin-shell" data-testid="admin-shell">
      <Sidebar
        variant="admin"
        navItems={ADMIN_NAV_ITEMS}
        userName={user?.fullName ?? 'User'}
        userRole={user?.role ?? 'PLATFORM_ADMIN'}
        onSignOut={logout}
      />
      <main className="admin-shell__main">
        <Outlet />
      </main>
    </div>
  )
}
