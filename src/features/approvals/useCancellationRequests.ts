import { useQuery } from '@tanstack/react-query'
import { getPendingCancellations } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export function cancellationRequestsQueryKey(userId: number | undefined) {
  return ['approvals', 'cancellations', userId] as const
}

/**
 * Plan VUELTA / FR-57. The Organization Admin's queue of retroactive cancellations. The API
 * scopes it to the caller's organization and returns an empty list — not a 403 — to anyone else,
 * but the query is still gated on the role so a manager's session never issues the request.
 */
export function useCancellationRequests(enabled: boolean) {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: cancellationRequestsQueryKey(userId),
    queryFn: getPendingCancellations,
    enabled: enabled && userId != null,
  })
}
