import { useMutation, useQueryClient } from '@tanstack/react-query'
import { markNotificationRead } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { notificationsQueryKey } from './useNotifications'
import { unreadNotificationCountQueryKey } from './useUnreadNotificationCount'

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id

  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey(userId) })
      void queryClient.invalidateQueries({ queryKey: unreadNotificationCountQueryKey(userId) })
    },
  })
}
