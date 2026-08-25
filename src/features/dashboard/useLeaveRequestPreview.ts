import { useQuery } from '@tanstack/react-query'
import { previewLeaveRequest } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export function useLeaveRequestPreview(
  dateFrom: string,
  dateTo: string,
  leaveTypeId?: number,
) {
  const { user } = useAuth()
  const userId = user?.id
  const datesValid =
    dateFrom !== '' && dateTo !== '' && dateTo >= dateFrom

  return useQuery({
    queryKey: ['leave-requests', 'preview', userId, dateFrom, dateTo, leaveTypeId],
    // The server rejects a preview for a deactivated type, so the selected type travels with
    // the request: without it the user gets a clean working-day count and only discovers the
    // type is gone when submit fails.
    queryFn: () => previewLeaveRequest({ dateFrom, dateTo, leaveTypeId }),
    enabled: userId != null && datesValid,
    staleTime: 30_000,
  })
}
