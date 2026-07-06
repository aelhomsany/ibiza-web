import { useQuery } from '@tanstack/react-query'
import { getNotifications } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export function notificationsQueryKey(userId: number | undefined) {
  return ['notifications', userId] as const
}

export function useNotifications(enabled = true) {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: notificationsQueryKey(userId),
    queryFn: getNotifications,
    enabled: enabled && userId != null,
  })
}
