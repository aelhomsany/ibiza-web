import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { BuildingIcon } from '../ui/icons'
import { AppHeader } from './AppHeader'
import { Sidebar, type NavItem } from './Sidebar'
import { UserMenu } from './UserMenu'
import { LanguageSwitcher } from './LanguageSwitcher'
import { SkipToMainLink } from './SkipToMainLink'
import { useMobileNavDrawer } from './useMobileNavDrawer'
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
  const { t, i18n } = useTranslation(['layout', 'common'])
  const { user, logout } = useAuth()
  const { navOpen, menuButtonRef, closeNav, toggleNav, onNavigate } =
    useMobileNavDrawer()
  const location = useLocation()

  return (
    <div className="admin-shell" data-testid="admin-shell">
      <SkipToMainLink inert={navOpen} />
      <div className="admin-shell__body">
        <Sidebar
          variant="admin"
          navItems={ADMIN_NAV_ITEMS.map((item) => {
            const key = item.testId?.replace('nav-', '') ?? ''
            return { ...item, label: i18n.exists(`layout:nav.${key}`) ? t(`nav.${key}`) : item.label }
          })}
          logoTitle={t('common:brand.admin')}
          logoSubtitle={t('common:brand.platformConsole')}
          mobileOpen={navOpen}
          onNavigate={onNavigate}
        />
        {navOpen ? (
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label={t('layout:header.closeNavigation')}
            data-testid="sidebar-backdrop"
            onMouseDown={(event) => event.preventDefault()}
            onClick={closeNav}
          />
        ) : null}
        <div className="admin-shell__content">
          <AppHeader
            variant="admin"
            title={t('common:brand.admin')}
            contextLabel={t('common:roles.platformAdmin')}
            actions={
              <>
                <LanguageSwitcher />
                <UserMenu
                  userName={user?.fullName ?? t('layout:header.userFallback')}
                  userRole={user?.role ?? 'PLATFORM_ADMIN'}
                  profileImageUrl={user?.profileImageUrl}
                  onSignOut={logout}
                  variant="admin"
                  languageSwitcher={<LanguageSwitcher compact />}
                />
              </>
            }
            navOpen={navOpen}
            menuButtonRef={menuButtonRef}
            onToggleNav={toggleNav}
            actionsInert={navOpen}
          />
          <main
            id="main-content"
            className="admin-shell__main"
            tabIndex={-1}
            {...(navOpen ? { inert: true } : {})}
          >
            <ErrorBoundary variant="route" key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  )
}
