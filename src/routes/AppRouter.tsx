import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthProvider'
import { AdminShell } from '../components/layout/AdminShell'
import { OrgShell } from '../components/layout/OrgShell'
import { DashboardPlaceholder } from '../features/dashboard/DashboardPlaceholder'
import { ForgotPasswordPage } from '../features/login/ForgotPasswordPage'
import { LoginPage } from '../features/login/LoginPage'
import { ResetPasswordPage } from '../features/login/ResetPasswordPage'
import { OrganizationsPlaceholder } from '../features/platform/OrganizationsPlaceholder'
import { SettingsPage } from '../features/settings/SettingsPage'
import { PagePlaceholder } from '../features/shared/PagePlaceholder'
import { ProtectedRoute } from './ProtectedRoute'
import { RoleGuard } from './RoleGuard'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<RoleGuard shell="org" />}>
          <Route element={<OrgShell />}>
            <Route path="/" element={<DashboardPlaceholder />} />
            <Route
              path="/my-leaves"
              element={
                <PagePlaceholder
                  title="My Leaves"
                  subtitle="Your leave history and balances"
                />
              }
            />
            <Route
              path="/calendar"
              element={
                <PagePlaceholder
                  title="Team Calendar"
                  subtitle="Org-wide leave coverage"
                />
              }
            />
            <Route
              path="/approvals"
              element={
                <PagePlaceholder
                  title="Approvals"
                  subtitle="Pending leave requests"
                />
              }
            />
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
            <Route path="/platform/organizations" element={<OrganizationsPlaceholder />} />
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
