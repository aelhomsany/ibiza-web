import { useMutation, useQueryClient } from '@tanstack/react-query'
import { markAllNotificationsRead } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { notificationsQueryKey } from './useNotifications'
import { unreadNotificationCountQueryKey } from './useUnreadNotificationCount'

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id

  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey(userId) })
      void queryClient.invalidateQueries({ queryKey: unreadNotificationCountQueryKey(userId) })
    },
  })
}
