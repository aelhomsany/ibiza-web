import { Suspense, lazy, type ReactElement, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Navigate,
  Route,
  RouterProvider,
  Routes,
  createBrowserRouter,
} from 'react-router-dom'
import { AuthProvider } from '../auth/AuthProvider'
import { OrgShell } from '../components/layout/OrgShell'
import { LoginPage } from '../features/login/LoginPage'
import { PagePlaceholder } from '../features/shared/PagePlaceholder'
import { usePageTitle } from '../hooks/usePageTitle'
import { ProtectedRoute } from './ProtectedRoute'
import { RoleGuard } from './RoleGuard'

// Customer realm only. Platform Admin lives in its own artifact
// (src/apps/admin/AdminRouter.tsx) behind PlatformAuthProvider — importing any of it
// here would put operator screens back inside the customer bundle and under the
// customer AuthProvider, which is the boundary Story 12.1 exists to establish.
//
// Route-level code splitting: each page loads on demand. Login stays eager — it is
// the first paint for signed-out users.
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
const AcceptInvitationPage = lazy(() =>
  import('../features/login/AcceptInvitationPage').then((m) => ({
    default: m.AcceptInvitationPage,
  })),
)
const TeamCalendarPage = lazy(() =>
  import('../features/calendar/TeamCalendarPage').then((m) => ({
    default: m.TeamCalendarPage,
  })),
)
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const ProfilePage = lazy(() =>
  import('../features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const MySettingsPage = lazy(() =>
  import('../features/my-settings/MySettingsPage').then((m) => ({ default: m.MySettingsPage })),
)
const ApprovalsPage = lazy(() =>
  import('../features/approvals/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })),
)
const PlanAndBillingPage = lazy(() =>
  import('../features/billing/PlanAndBillingPage').then((module) => ({ default: module.PlanAndBillingPage })),
)
const OnboardingPage = lazy(() =>
  import('../features/onboarding/OnboardingPage').then((module) => ({ default: module.OnboardingPage })),
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
        <Route
          path="/accept-invitation"
          element={withPageTitle('routes.acceptInvitation', <AcceptInvitationPage />)}
        />

        <Route element={<ProtectedRoute />}>
          {/* OrgShell unconditionally: ProfileRouteShell used to branch to AdminShell
              for PLATFORM_ADMIN, which pulled the operator shell into the customer
              bundle. Operator profile lives in the Admin artifact. */}
          <Route element={<OrgShell />}>
            <Route
              path="/profile"
              element={withPageTitle('routes.profile', <ProfilePage />)}
            />
          </Route>

          <Route element={<RoleGuard shell="org" />}>
            <Route element={<OrgShell />}>
              {/* The Dashboard merged into /my-leaves (2026-09-01); the Team Calendar is
                  the landing screen. Keep '/' as a redirect so bookmarks still work. */}
              <Route path="/" element={<Navigate to="/calendar" replace />} />
              <Route path="/my-leaves" element={withPageTitle('routes.myLeaves', <MyLeavesPage />)} />
              <Route path="/my-settings" element={withPageTitle('routes.mySettings', <MySettingsPage />)} />
              <Route
                path="/leave-requests/:id"
                element={withPageTitle('routes.requestDetails', <RequestContextPage />)}
              />
              <Route path="/calendar" element={withPageTitle('routes.calendar', <TeamCalendarPage />)} />
              <Route path="/approvals" element={withPageTitle('routes.approvals', <ApprovalsPage />)} />
              <Route path="/settings" element={withPageTitle('routes.settings', <SettingsPage />)} />
              <Route path="/onboarding" element={withPageTitle('routes.onboarding', <OnboardingPage />)} />
              <Route path="/settings/billing" element={withPageTitle('routes.billing', <PlanAndBillingPage />)} />
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

      </Routes>
    </Suspense>
  )
}

export function AppRouter() {
  const router = useMemo(
    () =>
      createBrowserRouter([
        {
          path: '*',
          element: (
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          ),
        },
      ]),
    [],
  )

  return <RouterProvider router={router} />
}
