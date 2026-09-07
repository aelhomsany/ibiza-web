import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cancelLeaveRequest, requestLeaveCancellation } from '../../api/client'

/**
 * Plan VUELTA / FR-56. Both writes move the same read models — the requester's own request list
 * and balances, every calendar feed the leave appeared in, the approver inbox a withdrawn request
 * leaves, and the notification bell — so they share one invalidation set rather than each guessing
 * a narrower one. The prefixes are deliberately broad: React Query matches by key prefix, and a
 * cancellation is rare enough that a few extra refetches cost less than a stale balance card.
 */
function useCancellationInvalidation() {
  const queryClient = useQueryClient()
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    void queryClient.invalidateQueries({ queryKey: ['approvals'] })
    void queryClient.invalidateQueries({ queryKey: ['calendar'] })
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }, [queryClient])
}

/** Self-service: withdraw a PENDING request, or cancel an APPROVED one that has not started. */
export function useCancelLeave() {
  const invalidate = useCancellationInvalidation()

  return useMutation({
    mutationFn: (args: { requestId: number }) => cancelLeaveRequest(args.requestId),
    onSuccess: invalidate,
  })
}

/** Retroactive: ask the Organization Admin to give back leave that has already started. */
export function useRequestLeaveCancellation() {
  const invalidate = useCancellationInvalidation()

  return useMutation({
    mutationFn: (args: { requestId: number; reason: string }) =>
      requestLeaveCancellation(args.requestId, args.reason),
    onSuccess: invalidate,
  })
}
