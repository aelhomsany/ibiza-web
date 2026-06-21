import { useQuery } from '@tanstack/react-query'
import { getRecentApprovalDecisions } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import type { UserRole } from '../../api/generated/types'

const APPROVAL_ROLES: UserRole[] = ['MANAGER', 'HR_ADMIN']

export function recentApprovalDecisionsQueryKey(userId: number | undefined) {
  return ['approvals', 'recent-decisions', userId] as const
}

export function useRecentApprovalDecisions() {
  const { user } = useAuth()
  const userId = user?.id
  const role = user?.role
  const enabled = userId != null && role != null && APPROVAL_ROLES.includes(role)

  return useQuery({
    queryKey: recentApprovalDecisionsQueryKey(userId),
    queryFn: getRecentApprovalDecisions,
    enabled,
  })
}
