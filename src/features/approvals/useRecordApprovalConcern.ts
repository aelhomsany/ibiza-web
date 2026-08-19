import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recordApprovalConcern } from '../../api/client'

export function useRecordApprovalConcern() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { requestId: number; note: string; approvalLevel: number }) =>
      recordApprovalConcern(args.requestId, args.note, args.approvalLevel),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['approvals'] })
      void queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
