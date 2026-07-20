import { Suspense, lazy, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthProvider'
import { AdminShell } from '../components/layout/AdminShell'
import { OrgShell } from '../components/layout/OrgShell'
import { ProfileRouteShell } from '../components/layout/ProfileRouteShell'
import { LoginPage } from '../features/login/LoginPage'
import { PagePlaceholder } from '../features/shared/PagePlaceholder'
import { usePageTitle } from '../hooks/usePageTitle'
import { ProtectedRoute } from './ProtectedRoute'
import { RoleGuard } from './RoleGuard'

// Route-level code splitting: each page loads on demand so org users don't
// download platform-admin screens and vice versa. Login stays eager — it is
// the first paint for signed-out users.
const DashboardPage = lazy(() =>
  import('../features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const MyLeavesPage = lazy(() =>
  import('../features/my-leaves/MyLeavesPage').then((m) => ({ default: m.MyLeavesPage })),
)
const RequestContextPage = lazy(() =>
  import('../features/leave-requests/RequestContextPage').then((m) => ({
    default: m.RequestContextPage,
  })),
)
const ForgotPasswordPage = lazy(() =>
  import('../features/login/ForgotPasswordPage').then((m) => ({
    default: m.ForgotPasswordPage,
  })),
)
const ResetPasswordPage = lazy(() =>
  import('../features/login/ResetPasswordPage').then((m) => ({
    default: m.ResetPasswordPage,
  })),
)
const TeamCalendarPage = lazy(() =>
  import('../features/calendar/TeamCalendarPage').then((m) => ({
    default: m.TeamCalendarPage,
  })),
)
const OrganizationsPage = lazy(() =>
  import('../features/platform/OrganizationsPage').then((m) => ({
    default: m.OrganizationsPage,
  })),
)
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const ProfilePage = lazy(() =>
  import('../features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const ApprovalsPage = lazy(() =>
  import('../features/approvals/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })),
)

function RouteFallback() {
  const { t } = useTranslation('common')
  return (
    <div className="page" aria-busy="true">
      <p className="body-text">{t('loading')}</p>
    </div>
  )
}

function TitledRoute({ titleKey, children }: { titleKey: string; children: ReactElement }) {
  const { t } = useTranslation('common')
  usePageTitle(t(titleKey))
  return children
}

function withPageTitle(titleKey: string, element: ReactElement) {
  return <TitledRoute titleKey={titleKey}>{element}</TitledRoute>
}

export function AppRoutes() {
  const { t } = useTranslation('common')
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={withPageTitle('routes.signIn', <LoginPage />)} />
        <Route path="/forgot-password" element={withPageTitle('routes.forgotPassword', <ForgotPasswordPage />)} />
        <Route path="/reset-password" element={withPageTitle('routes.resetPassword', <ResetPasswordPage />)} />

        <Route element={<ProtectedRoute />}>
          <Route element={<ProfileRouteShell />}>
            <Route
              path="/profile"
              element={withPageTitle('routes.profile', <ProfilePage />)}
            />
          </Route>

          <Route element={<RoleGuard shell="org" />}>
            <Route element={<OrgShell />}>
              <Route path="/" element={withPageTitle('routes.dashboard', <DashboardPage />)} />
              <Route path="/my-leaves" element={withPageTitle('routes.myLeaves', <MyLeavesPage />)} />
              <Route
                path="/leave-requests/:id"
                element={withPageTitle('routes.requestDetails', <RequestContextPage />)}
              />
              <Route path="/calendar" element={withPageTitle('routes.calendar', <TeamCalendarPage />)} />
              <Route path="/approvals" element={withPageTitle('routes.approvals', <ApprovalsPage />)} />
              <Route path="/settings" element={withPageTitle('routes.settings', <SettingsPage />)} />
              <Route
                path="*"
                element={withPageTitle(
                  'notFound.title',
                  <PagePlaceholder
                    title={t('notFound.title')}
                    subtitle={t('notFound.subtitle')}
                  />,
                )}
              />
            </Route>
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<RoleGuard shell="admin" />}>
            <Route element={<AdminShell />}>
              <Route
                path="/platform"
                element={<Navigate to="/platform/organizations" replace />}
              />
              <Route
                path="/platform/organizations"
                element={withPageTitle('routes.organizations', <OrganizationsPage />)}
              />
              <Route
                path="/platform/*"
                element={withPageTitle(
                  'notFound.title',
                  <PagePlaceholder
                    title={t('notFound.title')}
                    subtitle={t('notFound.subtitle')}
                  />,
                )}
              />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
