import { useQuery } from '@tanstack/react-query'
import { getApprovalCapability } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export function approvalCapabilityQueryKey(userId: number | undefined) {
  return ['approvals', 'capability', userId] as const
}

export function useApprovalCapability() {
  const { user } = useAuth()
  const initialCapability = user?.canReviewApprovals
    ?? (user?.role === 'MANAGER' || user?.role === 'HR_ADMIN')
  return useQuery({
    queryKey: approvalCapabilityQueryKey(user?.id),
    queryFn: getApprovalCapability,
    enabled: user?.id != null && user.role !== 'PLATFORM_ADMIN',
    initialData: user == null || user.role === 'PLATFORM_ADMIN'
      ? undefined
      : { canReviewApprovals: initialCapability },
    initialDataUpdatedAt: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })
}
