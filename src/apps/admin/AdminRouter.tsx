import { Suspense, lazy, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Navigate,
  Route,
  RouterProvider,
  Routes,
  createBrowserRouter,
} from 'react-router-dom'
import { PlatformLoginPage } from '../../features/platform-auth/PlatformLoginPage'
import { PlatformAuthProvider } from '../../features/platform-auth/PlatformAuthProvider'
import { PlatformAdminShell } from './PlatformAdminShell'
import { PlatformProtectedRoute } from './PlatformProtectedRoute'

const OrganizationsPage = lazy(() =>
  import('../../features/platform/OrganizationsPage').then((module) => ({
    default: module.OrganizationsPage,
  })),
)
const PaidRegistrationRecoveryPage = lazy(() =>
  import('../../features/platform/PaidRegistrationRecoveryPage').then((module) => ({
    default: module.PaidRegistrationRecoveryPage,
  })),
)
const PlatformProfilePage = lazy(() =>
  import('../../features/platform-profile/PlatformProfilePage').then((module) => ({
    default: module.PlatformProfilePage,
  })),
)

function OrganizationsRoute() {
  const { t } = useTranslation(['common', 'platformAuth'])
  useEffect(() => {
    document.title = `${t('common:routes.organizations')} | ${t('platformAuth:realm')} | ${t('common:brand.name')}`
  }, [t])
  return <OrganizationsPage />
}

function ProfileRoute() {
  const { t } = useTranslation(['platformAuth', 'common'])
  useEffect(() => {
    document.title = `${t('platformAuth:profile.title')} | ${t('platformAuth:realm')} | ${t('common:brand.name')}`
  }, [t])
  return <PlatformProfilePage />
}

function NotFound() {
  const { t } = useTranslation(['platformAuth', 'common'])
  useEffect(() => {
    document.title = `${t('notFound.title')} | ${t('common:brand.name')}`
  }, [t])
  return (
    <div className="page">
      <h1 className="page-title">{t('notFound.title')}</h1>
      <p className="page-sub">{t('notFound.body')}</p>
      <a className="btn btn-admin" href="/app-admin/organizations">
        {t('notFound.action')}
      </a>
    </div>
  )
}

export function AdminRoutes() {
  const { t } = useTranslation('common')
  return (
    <Suspense
      fallback={
        <div className="page" aria-busy="true">
          <p>{t('loading')}</p>
        </div>
      }
    >
      <Routes>
        <Route path="/app-admin/login" element={<PlatformLoginPage />} />
        <Route element={<PlatformProtectedRoute />}>
          <Route element={<PlatformAdminShell />}>
            <Route
              path="/app-admin"
              element={<Navigate to="/app-admin/organizations" replace />}
            />
            <Route path="/app-admin/organizations" element={<OrganizationsRoute />} />
            <Route path="/app-admin/registration-recovery" element={<PaidRegistrationRecoveryPage />} />
            <Route path="/app-admin/profile" element={<ProfileRoute />} />
            <Route path="/app-admin/*" element={<NotFound />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/app-admin/login" replace />} />
      </Routes>
    </Suspense>
  )
}

export function AdminRouter() {
  const router = useMemo(
    () =>
      createBrowserRouter([
        {
          path: '*',
          element: (
            <PlatformAuthProvider>
              <AdminRoutes />
            </PlatformAuthProvider>
          ),
        },
      ]),
    [],
  )
  return <RouterProvider router={router} />
}
