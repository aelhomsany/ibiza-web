import { useQuery } from '@tanstack/react-query'
import { getDashboardBalances } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export function useDashboardBalances() {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: ['dashboard', 'balances', userId],
    queryFn: getDashboardBalances,
    enabled: userId != null,
  })
}
