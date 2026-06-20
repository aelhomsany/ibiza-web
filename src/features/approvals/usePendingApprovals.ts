import { useQuery } from '@tanstack/react-query'
import { getPendingApprovals } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export function pendingApprovalsQueryKey(userId: number | undefined) {
  return ['approvals', 'pending', userId] as const
}

export function usePendingApprovals() {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: pendingApprovalsQueryKey(userId),
    queryFn: getPendingApprovals,
    enabled: userId != null,
  })
}
