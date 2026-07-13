import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router-dom'
import { getOrgNavItems } from '../../auth/rolePermissions'
import { useAuth } from '../../auth/useAuth'
import { usePendingApprovalCount } from '../../features/approvals/usePendingApprovalCount'
import { NotificationBell } from '../../features/notifications/NotificationBell'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { AppHeader } from './AppHeader'
import { Sidebar } from './Sidebar'
import { UserMenu } from './UserMenu'
import { LanguageSwitcher } from './LanguageSwitcher'
import { useMobileNavDrawer } from './useMobileNavDrawer'
import './org-shell.css'

export function OrgShell() {
  const { t, i18n } = useTranslation('layout')
  const { user, logout } = useAuth()
  const role = user?.role ?? 'EMPLOYEE'
  const { data: pendingCountData } = usePendingApprovalCount()
  const pendingCount = pendingCountData?.count ?? 0
  const { navOpen, menuButtonRef, closeNav, toggleNav, onNavigate } =
    useMobileNavDrawer()
  const location = useLocation()

  const navItems = getOrgNavItems(role).map((item) => {
    const sourceKey = item.testId?.replace('nav-', '') ?? ''
    const key = sourceKey === 'my-leaves' ? 'myLeaves' : sourceKey
    const label = i18n.exists(`layout:nav.${key}`) ? t(`nav.${key}`) : item.label
    return item.path === '/approvals' && pendingCount > 0
      ? { ...item, label, badge: pendingCount }
      : { ...item, label }
  })

  return (
    <div className="org-shell" data-testid="org-shell">
      <div className="org-shell__body">
        <Sidebar
          variant="org"
          navItems={navItems}
          mobileOpen={navOpen}
          onNavigate={onNavigate}
        />
        {navOpen ? (
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label="Close navigation"
            data-testid="sidebar-backdrop"
            onMouseDown={(event) => event.preventDefault()}
            onClick={closeNav}
          />
        ) : null}
        <div className="org-shell__content">
          <AppHeader
            variant="org"
            title="Ibiza"
            contextLabel={user?.organizationName}
            actions={
              <>
                <LanguageSwitcher />
                <NotificationBell />
                <UserMenu
                  userName={user?.fullName ?? 'User'}
                  userRole={role}
                  profileImageUrl={user?.profileImageUrl}
                  onSignOut={logout}
                  variant="org"
                  languageSwitcher={<LanguageSwitcher compact />}
                />
              </>
            }
            navOpen={navOpen}
            menuButtonRef={menuButtonRef}
            onToggleNav={toggleNav}
          />
          <main className="org-shell__main" {...(navOpen ? { inert: true } : {})}>
            <ErrorBoundary variant="route" key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  )
}
