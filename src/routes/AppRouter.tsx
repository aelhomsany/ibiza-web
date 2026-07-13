import { Suspense, lazy, type ReactElement } from 'react'
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
  return (
    <div className="page" aria-busy="true">
      <p className="body-text">Loading…</p>
    </div>
  )
}

function TitledRoute({ title, children }: { title: string; children: ReactElement }) {
  usePageTitle(title)
  return children
}

function withPageTitle(title: string, element: ReactElement) {
  return <TitledRoute title={title}>{element}</TitledRoute>
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={withPageTitle('Sign in', <LoginPage />)} />
        <Route path="/forgot-password" element={withPageTitle('Forgot password', <ForgotPasswordPage />)} />
        <Route path="/reset-password" element={withPageTitle('Reset password', <ResetPasswordPage />)} />

        <Route element={<ProtectedRoute />}>
          <Route element={<ProfileRouteShell />}>
            <Route
              path="/profile"
              element={withPageTitle('Profile details', <ProfilePage />)}
            />
          </Route>

          <Route element={<RoleGuard shell="org" />}>
            <Route element={<OrgShell />}>
              <Route path="/" element={withPageTitle('Dashboard', <DashboardPage />)} />
              <Route path="/my-leaves" element={withPageTitle('My Leaves', <MyLeavesPage />)} />
              <Route
                path="/leave-requests/:id"
                element={withPageTitle('Request Details', <RequestContextPage />)}
              />
              <Route path="/calendar" element={withPageTitle('Team Calendar', <TeamCalendarPage />)} />
              <Route path="/approvals" element={withPageTitle('Approvals', <ApprovalsPage />)} />
              <Route path="/settings" element={withPageTitle('Settings', <SettingsPage />)} />
              <Route
                path="*"
                element={withPageTitle(
                  'Page Not Found',
                  <PagePlaceholder
                    title="Page Not Found"
                    subtitle="The page you're looking for doesn't exist."
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
                element={withPageTitle('Organizations', <OrganizationsPage />)}
              />
              <Route
                path="/platform/*"
                element={withPageTitle(
                  'Page Not Found',
                  <PagePlaceholder
                    title="Page Not Found"
                    subtitle="The page you're looking for doesn't exist."
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
