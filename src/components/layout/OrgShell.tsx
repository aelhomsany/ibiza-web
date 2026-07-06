import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { getOrgNavItems } from '../../auth/rolePermissions'
import { useAuth } from '../../auth/useAuth'
import { usePendingApprovalCount } from '../../features/approvals/usePendingApprovalCount'
import { NotificationBell } from '../../features/notifications/NotificationBell'
import { AppHeader } from './AppHeader'
import { Sidebar } from './Sidebar'
import './org-shell.css'

export function OrgShell() {
  const { user, logout } = useAuth()
  const role = user?.role ?? 'EMPLOYEE'
  const { data: pendingCountData } = usePendingApprovalCount()
  const pendingCount = pendingCountData?.count ?? 0
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

  const navItems = getOrgNavItems(role).map((item) =>
    item.path === '/approvals' && pendingCount > 0
      ? { ...item, badge: pendingCount }
      : item,
  )

  return (
    <div className="org-shell" data-testid="org-shell">
      <div className="org-shell__body">
        <Sidebar
          variant="org"
          navItems={navItems}
          userName={user?.fullName ?? 'User'}
          userRole={role}
          onSignOut={logout}
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
        <div className="org-shell__content">
          <AppHeader
            variant="org"
            title="Ibiza"
            contextLabel={user?.organizationName}
            actions={<NotificationBell />}
            navOpen={navOpen}
            onToggleNav={() => setNavOpen((open) => !open)}
          />
          <main className="org-shell__main">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
