import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthProvider'
import { AdminShell } from '../components/layout/AdminShell'
import { OrgShell } from '../components/layout/OrgShell'
import { LoginPage } from '../features/login/LoginPage'
import { PagePlaceholder } from '../features/shared/PagePlaceholder'
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

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<RoleGuard shell="org" />}>
            <Route element={<OrgShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/my-leaves" element={<MyLeavesPage />} />
              <Route path="/leave-requests/:id" element={<RequestContextPage />} />
              <Route path="/calendar" element={<TeamCalendarPage />} />
              <Route path="/approvals" element={<ApprovalsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route
                path="*"
                element={
                  <PagePlaceholder
                    title="Page Not Found"
                    subtitle="The page you're looking for doesn't exist."
                  />
                }
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
              <Route path="/platform/organizations" element={<OrganizationsPage />} />
              <Route
                path="/platform/*"
                element={
                  <PagePlaceholder
                    title="Page Not Found"
                    subtitle="The page you're looking for doesn't exist."
                  />
                }
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
