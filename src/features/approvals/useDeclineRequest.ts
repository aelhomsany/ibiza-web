import { useMutation, useQueryClient } from '@tanstack/react-query'
import { declineLeaveRequest } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export function useDeclineRequest() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const orgId = user?.organizationId

  return useMutation({
    mutationFn: (args: { requestId: number; employeeUserId: number; reason: string; approvalLevel: number }) =>
      declineLeaveRequest(args.requestId, args.reason, args.approvalLevel),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] })
      void queryClient.invalidateQueries({ queryKey: ['approvals', 'pending-count'] })
      void queryClient.invalidateQueries({ queryKey: ['approvals', 'recent-decisions'] })
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
