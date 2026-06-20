import { useQuery } from '@tanstack/react-query'
import { getDashboardRecentRequests } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export function useDashboardRecentRequests() {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: ['dashboard', 'recent-requests', userId],
    queryFn: getDashboardRecentRequests,
    enabled: userId != null,
  })
}
