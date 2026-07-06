import { useQuery } from '@tanstack/react-query'
import { getCalendarMonth } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export function calendarMonthQueryKey(
  userId: number | undefined,
  month: string,
  workforceGroupId?: number,
) {
  return ['calendar', 'month', userId, month, workforceGroupId ?? 'all'] as const
}

export function useCalendarMonth(month: string, workforceGroupId?: number) {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: calendarMonthQueryKey(userId, month, workforceGroupId),
    queryFn: () => (
      workforceGroupId == null
        ? getCalendarMonth(month)
        : getCalendarMonth(month, workforceGroupId)
    ),
    enabled: userId != null,
  })
}
