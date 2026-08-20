import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router-dom'
import { BuildingIcon, CheckIcon, GlobeIcon, RefreshCwIcon } from '../../components/ui/icons'
import { AppHeader } from '../../components/layout/AppHeader'
import { UserMenu } from '../../components/layout/UserMenu'
import { Sidebar, type NavItem } from '../../components/layout/Sidebar'
import { SkipToMainLink } from '../../components/layout/SkipToMainLink'
import { useMobileNavDrawer } from '../../components/layout/useMobileNavDrawer'
import {
  applyDocumentLanguage,
  storePreferredLanguage,
  type SupportedLocale,
} from '../../i18n/documentLanguage'
import i18n from '../../i18n/config'
import { ErrorBoundary } from '../../components/ui/ErrorBoundary'
import { usePlatformAuth } from '../../features/platform-auth/usePlatformAuth'
import '../../components/layout/admin-shell.css'
import './platform-admin-shell.css'

export function PlatformAdminShell() {
  const { t } = useTranslation(['platformAuth', 'common', 'layout'])
  const { user, logout } = usePlatformAuth()
  const { navOpen, menuButtonRef, closeNav, toggleNav, onNavigate } =
    useMobileNavDrawer()
  const location = useLocation()

  const navItems: NavItem[] = [
    {
      label: t('platformAuth:navigation.organizations'),
      path: '/app-admin/organizations',
      icon: BuildingIcon,
      testId: 'nav-organizations',
      end: true,
    },
    {
      label: t('platformAuth:navigation.registrationRecovery'),
      path: '/app-admin/registration-recovery',
      icon: RefreshCwIcon,
      testId: 'nav-registration-recovery',
      end: true,
    },
  ]

  async function changeLocale(locale: SupportedLocale) {
    await i18n.changeLanguage(locale)
    applyDocumentLanguage(locale)
    storePreferredLanguage(locale)
  }

  const activeLocale: SupportedLocale = i18n.language?.startsWith('ar') ? 'ar' : 'en'
  const localeOptions: { locale: SupportedLocale; label: string }[] = [
    { locale: 'en', label: t('platformAuth:actions.english') },
    { locale: 'ar', label: t('platformAuth:actions.arabic') },
  ]

  return (
    <div className="admin-shell platform-admin-shell" data-testid="admin-shell">
      <SkipToMainLink inert={navOpen} />
      <div className="admin-shell__body">
        <Sidebar
          variant="admin"
          navItems={navItems}
          logoTitle={t('platformAuth:realm')}
          logoSubtitle={t('platformAuth:operatorOnly')}
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
            title={t('platformAuth:realm')}
            contextLabel={`${t('platformAuth:operatorOnly')} · ${user?.fullName ?? ''}`}
            actions={
              <UserMenu
                userName={user?.fullName?.trim() || t('layout:header.userFallback')}
                userRole={user?.role ?? 'PLATFORM_ADMIN'}
                onSignOut={logout}
                variant="admin"
                languageSwitcher={
                  <div
                    className="platform-admin-language"
                    role="group"
                    aria-label={t('layout:header.language')}
                    data-testid="platform-admin-language"
                  >
                    <GlobeIcon size={18} aria-hidden="true" />
                    {localeOptions.map(({ locale, label }) => (
                      <button
                        key={locale}
                        type="button"
                        role="menuitemradio"
                        aria-checked={locale === activeLocale}
                        onClick={() => void changeLocale(locale)}
                      >
                        <span>{label}</span>
                        {locale === activeLocale ? (
                          <CheckIcon size={14} aria-label={t('layout:language.current')} />
                        ) : null}
                      </button>
                    ))}
                  </div>
                }
              />
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
