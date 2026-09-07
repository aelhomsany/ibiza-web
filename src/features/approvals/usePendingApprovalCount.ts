import { useQuery } from '@tanstack/react-query'
import {
  getPendingApprovalCount,
  getPendingCancellationCount,
} from '../../api/client'
import type { PendingApprovalCountResponse } from '../../api/generated/types'
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
  // Plan VUELTA: for an Organization Admin the badge is everything waiting on them, and
  // retroactive cancellations are only theirs to decide. Managers never see that queue, so
  // their count stays the leave-approval count alone.
  const isOrganizationAdmin = user?.role === 'ORGANIZATION_ADMIN'

  return useQuery({
    queryKey: pendingApprovalCountQueryKey(userId),
    queryFn: async (): Promise<PendingApprovalCountResponse> => {
      if (!isOrganizationAdmin) {
        return getPendingApprovalCount()
      }
      const [approvals, cancellations] = await Promise.all([
        getPendingApprovalCount(),
        getPendingCancellationCount(),
      ])
      return { count: (approvals.count ?? 0) + (cancellations.count ?? 0) }
    },
    enabled,
  })
}
