import { useQuery } from '@tanstack/react-query'
import { previewLeaveRequest } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export function useLeaveRequestPreview(dateFrom: string, dateTo: string) {
  const { user } = useAuth()
  const userId = user?.id
  const datesValid =
    dateFrom !== '' && dateTo !== '' && dateTo >= dateFrom

  return useQuery({
    queryKey: ['leave-requests', 'preview', userId, dateFrom, dateTo],
    queryFn: () => previewLeaveRequest({ dateFrom, dateTo }),
    enabled: userId != null && datesValid,
    staleTime: 30_000,
  })
}
