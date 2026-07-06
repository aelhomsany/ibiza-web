import { useQuery } from '@tanstack/react-query'
import { getLeaveRequestContext } from '../../api/client'

export function leaveRequestContextQueryKey(requestId: number | undefined) {
  return ['leave-request-context', requestId] as const
}

export function useLeaveRequestContext(requestId: number | undefined) {
  return useQuery({
    queryKey: leaveRequestContextQueryKey(requestId),
    queryFn: () => getLeaveRequestContext(requestId as number),
    enabled: requestId != null,
  })
}
