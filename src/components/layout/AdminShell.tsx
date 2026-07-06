import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { BuildingIcon } from '../ui/icons'
import { AppHeader } from './AppHeader'
import { Sidebar, type NavItem } from './Sidebar'
import './admin-shell.css'

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: 'Organizations',
    path: '/platform/organizations',
    icon: BuildingIcon,
    testId: 'nav-organizations',
    end: true,
  },
]

export function AdminShell() {
  const { user, logout } = useAuth()
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    if (!navOpen) {
      return undefined
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setNavOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navOpen])

  return (
    <div className="admin-shell" data-testid="admin-shell">
      <div className="admin-shell__body">
        <Sidebar
          variant="admin"
          navItems={ADMIN_NAV_ITEMS}
          userName={user?.fullName ?? 'User'}
          userRole={user?.role ?? 'PLATFORM_ADMIN'}
          onSignOut={logout}
          logoTitle="Ibiza Admin"
          logoSubtitle="Platform Console"
          mobileOpen={navOpen}
          onNavigate={() => setNavOpen(false)}
        />
        {navOpen ? (
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          />
        ) : null}
        <div className="admin-shell__content">
          <AppHeader
            variant="admin"
            title="Ibiza Admin"
            contextLabel="Platform Admin"
            navOpen={navOpen}
            onToggleNav={() => setNavOpen((open) => !open)}
          />
          <main className="admin-shell__main">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
