import { useQuery } from '@tanstack/react-query'
import { getPendingApprovalCount } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import type { UserRole } from '../../api/generated/types'

const APPROVAL_ROLES: UserRole[] = ['MANAGER', 'HR_ADMIN']

export function pendingApprovalCountQueryKey(userId: number | undefined) {
  return ['approvals', 'pending-count', userId] as const
}

export function usePendingApprovalCount() {
  const { user } = useAuth()
  const userId = user?.id
  const role = user?.role
  const enabled = userId != null && role != null && APPROVAL_ROLES.includes(role)

  return useQuery({
    queryKey: pendingApprovalCountQueryKey(userId),
    queryFn: getPendingApprovalCount,
    enabled,
  })
}
