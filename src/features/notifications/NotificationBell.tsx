import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../../i18n/config'
import { announceHeaderMenuOpen, onOtherHeaderMenuOpen } from '../../components/layout/headerMenuCoordination'
import { BellIcon } from '../../components/ui/icons'
import { NotificationPanel } from './NotificationPanel'
import { useNotifications } from './useNotifications'
import { useUnreadNotificationCount } from './useUnreadNotificationCount'
import './notifications.css'

const HEADER_MENU_ID = 'notification-bell'

export function NotificationBell() {
  const { t } = useTranslation('layout')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const unreadCountQuery = useUnreadNotificationCount()
  const notificationsQuery = useNotifications(open)
  const unreadCount = unreadCountQuery.data?.count ?? 0
  const notifications = useMemo(
    () => notificationsQuery.data ?? [],
    [notificationsQuery.data],
  )
  const ariaLabel =
    unreadCount > 0 ? t('notifications.unread', { count: unreadCount }) : t('notifications.label')

  const closePanel = useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) {
      requestAnimationFrame(() => {
        bellRef.current?.focus()
      })
    }
  }, [])

  const refocusAfterMarkAllRead = useCallback(() => {
    requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) {
        return
      }

      const firstItem = panel.querySelector<HTMLButtonElement>('.notification-item')
      if (firstItem) {
        firstItem.focus()
        return
      }

      const markAllButton = panel.querySelector<HTMLButtonElement>('.notification-mark-all')
      if (markAllButton) {
        markAllButton.focus()
      } else {
        panel.focus()
      }
    })
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        closePanel()
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closePanel()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, closePanel])

  useEffect(
    () =>
      onOtherHeaderMenuOpen(HEADER_MENU_ID, () => {
        // The action opening the other header menu owns focus.
        closePanel(false)
      }),
    [closePanel],
  )

  function handleTriggerClick() {
    setOpen((current) => {
      const next = !current
      if (next) {
        announceHeaderMenuOpen(HEADER_MENU_ID)
      } else {
        requestAnimationFrame(() => {
          bellRef.current?.focus()
        })
      }
      return next
    })
  }

  return (
    <div className="notification-bell-wrap" ref={containerRef}>
      <button
        ref={bellRef}
        type="button"
        className="notification-bell"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="true"
        data-testid="notification-bell"
        onClick={handleTriggerClick}
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
          ref={panelRef}
          notifications={notifications}
          isPending={notificationsQuery.isPending}
          onClose={closePanel}
          onAfterMarkAllRead={refocusAfterMarkAllRead}
        />
      ) : null}
    </div>
  )
}
