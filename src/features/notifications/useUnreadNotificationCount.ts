import { useQuery } from '@tanstack/react-query'
import { getUnreadNotificationCount } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export function unreadNotificationCountQueryKey(userId: number | undefined) {
  return ['notifications', 'unread-count', userId] as const
}

export function useUnreadNotificationCount() {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: unreadNotificationCountQueryKey(userId),
    queryFn: getUnreadNotificationCount,
    enabled: userId != null,
  })
}
