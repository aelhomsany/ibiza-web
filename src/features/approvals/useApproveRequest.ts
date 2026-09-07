import { useMutation, useQueryClient } from '@tanstack/react-query'
import { approveLeaveRequest } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export function useApproveRequest() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const orgId = user?.organizationId

  return useMutation({
    mutationFn: (args: { requestId: number; employeeUserId: number; approvalLevel: number }) =>
      approveLeaveRequest(args.requestId, args.approvalLevel),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] })
      void queryClient.invalidateQueries({ queryKey: ['approvals', 'pending-count'] })
      void queryClient.invalidateQueries({ queryKey: ['approvals', 'recent-decisions'] })
      // Plan VUELTA: deciding a leave that has an open cancellation review takes that card
      // out of the Organization Admin's queue, so refresh it here too.
      void queryClient.invalidateQueries({ queryKey: ['approvals', 'cancellations'] })
      void queryClient.invalidateQueries({ queryKey: ['approvals', 'capability'] })
      void queryClient.invalidateQueries({
        queryKey: ['dashboard', 'balances', variables.employeeUserId],
      })
      if (orgId != null) {
        void queryClient.invalidateQueries({ queryKey: ['leave-requests', orgId] })
      }
      void queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
