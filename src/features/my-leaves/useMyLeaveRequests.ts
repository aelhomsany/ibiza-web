import { useQuery } from '@tanstack/react-query'
import { getMyLeaveRequests } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export function myLeaveRequestsQueryKey(userId: number | undefined) {
  return ['leave-requests', 'me', userId] as const
}

export function useMyLeaveRequests() {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: myLeaveRequestsQueryKey(userId),
    queryFn: getMyLeaveRequests,
    enabled: userId != null,
  })
}
