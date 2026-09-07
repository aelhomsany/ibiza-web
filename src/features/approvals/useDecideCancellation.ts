import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  approveLeaveCancellation,
  declineLeaveCancellation,
} from '../../api/client'

/**
 * Plan VUELTA / FR-57 — the Organization Admin's two decisions on a retroactive cancellation.
 *
 * Approving restores the balance and moves the leave to `CANCELLED`; declining changes nothing at
 * all about the leave and only closes the cancellation row. Both are invalidated identically
 * anyway: after either decision the card leaves this queue, and after an approval the employee's
 * balances, request list and every calendar feed have moved.
 */
export function useDecideCancellation() {
  const queryClient = useQueryClient()

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['approvals'] })
    void queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    void queryClient.invalidateQueries({ queryKey: ['calendar'] })
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }, [queryClient])

  const approve = useMutation({
    mutationFn: (args: { requestId: number; note?: string }) =>
      approveLeaveCancellation(args.requestId, args.note),
    onSuccess: invalidate,
  })

  const decline = useMutation({
    mutationFn: (args: { requestId: number; note: string }) =>
      declineLeaveCancellation(args.requestId, args.note),
    onSuccess: invalidate,
  })

  return { approve, decline }
}
