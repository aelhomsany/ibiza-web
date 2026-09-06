import { useQuery } from '@tanstack/react-query'
import { getPendingApprovalCount } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { useApprovalCapability } from './useApprovalCapability'

export function pendingApprovalCountQueryKey(userId: number | undefined) {
  return ['approvals', 'pending-count', userId] as const
}

export function usePendingApprovalCount() {
  const { user } = useAuth()
  const capability = useApprovalCapability()
  const userId = user?.id
  const canReview = capability.data?.canReviewApprovals ?? user?.canReviewApprovals
    ?? (user?.role === 'MANAGER' || user?.role === 'ORGANIZATION_ADMIN')
  const enabled = userId != null && canReview

  return useQuery({
    queryKey: pendingApprovalCountQueryKey(userId),
    queryFn: getPendingApprovalCount,
    enabled,
  })
}
