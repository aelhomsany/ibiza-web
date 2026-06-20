import { useQuery } from '@tanstack/react-query'
import { getDashboardUpcoming } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export function useDashboardUpcoming() {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: ['dashboard', 'upcoming', userId],
    queryFn: getDashboardUpcoming,
    enabled: userId != null,
  })
}
