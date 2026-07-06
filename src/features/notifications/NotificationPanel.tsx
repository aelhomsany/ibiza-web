import { useNavigate } from 'react-router-dom'
import type { NotificationResponse } from '../../api/generated/types'
import { useMarkAllNotificationsRead } from './useMarkAllNotificationsRead'
import { useMarkNotificationRead } from './useMarkNotificationRead'
import './notifications.css'

type NotificationPanelProps = {
  notifications: NotificationResponse[]
  isPending?: boolean
  onClose: () => void
}

function formatNotificationTime(isoTimestamp: string | undefined): string {
  if (!isoTimestamp) {
    return ''
  }
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function NotificationPanel({
  notifications,
  isPending = false,
  onClose,
}: NotificationPanelProps) {
  const navigate = useNavigate()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  async function handleItemClick(notification: NotificationResponse) {
    if (!notification.read) {
      await markRead.mutateAsync(notification.id)
    }
    onClose()
    navigate(notification.linkPath)
  }

  return (
    <div className="notification-panel" data-testid="notification-panel">
      <div className="notification-panel-header">
        <span>Notifications</span>
        <button
          type="button"
          className="notification-mark-all"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || notifications.length === 0}
        >
          Mark all read
        </button>
      </div>

      {isPending ? (
        <p className="notification-empty">Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <p className="notification-empty">No notifications yet</p>
      ) : (
        <div className="notification-list" role="list">
          {notifications.map((notification) => {
            const unread = !notification.read

            return (
              <div key={notification.id} role="listitem">
                <button
                  type="button"
                  className={`notification-item${unread ? ' notification-item--unread' : ''}`}
                  onClick={() => void handleItemClick(notification)}
                >
                  {unread ? <span className="notification-unread-dot" aria-hidden="true" /> : null}
                  <span className="notification-content">
                    <span className="notification-text">{notification.message}</span>
                    <span className="notification-time">
                      {formatNotificationTime(notification.occurredAt)}
                    </span>
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
