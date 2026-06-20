import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createLeaveRequest } from '../../api/client'
import type { CreateLeaveRequestRequest } from '../../api/generated/types'
import { useAuth } from '../../auth/useAuth'
import { myLeaveRequestsQueryKey } from '../my-leaves/useMyLeaveRequests'

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id

  return useMutation({
    mutationFn: (payload: CreateLeaveRequestRequest) => createLeaveRequest(payload),
    onSuccess: () => {
      if (userId != null) {
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'recent-requests', userId] })
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'balances', userId] })
        queryClient.invalidateQueries({ queryKey: myLeaveRequestsQueryKey(userId) })
      }
    },
  })
}
