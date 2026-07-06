import { useEffect, useRef, useState } from 'react'
import { BellIcon } from '../../components/ui/icons'
import { NotificationPanel } from './NotificationPanel'
import { useNotifications } from './useNotifications'
import { useUnreadNotificationCount } from './useUnreadNotificationCount'
import './notifications.css'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const unreadCountQuery = useUnreadNotificationCount()
  const notificationsQuery = useNotifications(open)
  const unreadCount = unreadCountQuery.data?.count ?? 0
  const ariaLabel =
    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="notification-bell-wrap" ref={containerRef}>
      <button
        type="button"
        className="notification-bell"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="true"
        data-testid="notification-bell"
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true" className="notification-bell-icon">
          <BellIcon size={18} />
        </span>
        {unreadCount > 0 ? (
          <span className="notification-badge" data-testid="notification-badge">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <NotificationPanel
          notifications={notificationsQuery.data ?? []}
          isPending={notificationsQuery.isPending}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  )
}
