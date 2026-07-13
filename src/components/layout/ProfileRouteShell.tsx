import { useAuth } from '../../auth/useAuth'
import { AdminShell } from './AdminShell'
import { OrgShell } from './OrgShell'

/** Picks the correct shell for /profile so platform admins stay in AdminShell. */
export function ProfileRouteShell() {
  const { user } = useAuth()
  if (user?.role === 'PLATFORM_ADMIN') {
    return <AdminShell />
  }
  return <OrgShell />
}
