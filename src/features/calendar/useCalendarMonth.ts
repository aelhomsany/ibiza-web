import { useQueries, useQuery } from '@tanstack/react-query'
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

export function useCalendarMonths(months: string[], workforceGroupId?: number) {
  const { user } = useAuth()
  const userId = user?.id

  return useQueries({
    queries: months.map((month) => ({
      queryKey: calendarMonthQueryKey(userId, month, workforceGroupId),
      queryFn: () => (
        workforceGroupId == null
          ? getCalendarMonth(month)
          : getCalendarMonth(month, workforceGroupId)
      ),
      enabled: userId != null,
    })),
    combine: (results) => ({
      data: results.every((result) => result.data != null)
        ? results.map((result) => result.data!)
        : undefined,
      isPending: results.some((result) => result.isPending),
      isError: results.some((result) => result.isError),
      isSuccess: results.length > 0 && results.every((result) => result.isSuccess),
      // Surface every failed month's error, not just the first — a query
      // array spans multiple months (e.g. a week overlapping a month
      // boundary), and picking only the first would misattribute the
      // failure when a different month is the one actually visible.
      errors: results.map((result) => result.error).filter((error) => error != null),
    }),
  })
}
