import { useQuery } from '@tanstack/react-query'
import { getDashboardOutToday } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export function useDashboardOutToday() {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: ['dashboard', 'out-today', userId],
    queryFn: getDashboardOutToday,
    enabled: userId != null,
  })
}
