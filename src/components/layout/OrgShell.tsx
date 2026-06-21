import { Outlet } from 'react-router-dom'
import { getOrgNavItems } from '../../auth/rolePermissions'
import { useAuth } from '../../auth/useAuth'
import { usePendingApprovalCount } from '../../features/approvals/usePendingApprovalCount'
import { Sidebar } from './Sidebar'
import './org-shell.css'

export function OrgShell() {
  const { user, logout } = useAuth()
  const role = user?.role ?? 'EMPLOYEE'
  const { data: pendingCountData } = usePendingApprovalCount()
  const pendingCount = pendingCountData?.count ?? 0

  const navItems = getOrgNavItems(role).map((item) =>
    item.path === '/approvals' && pendingCount > 0
      ? { ...item, badge: pendingCount }
      : item,
  )

  return (
    <div className="org-shell" data-testid="org-shell">
      <Sidebar
        variant="org"
        navItems={navItems}
        userName={user?.fullName ?? 'User'}
        userRole={role}
        onSignOut={logout}
      />
      <main className="org-shell__main">
        <Outlet />
      </main>
    </div>
  )
}
