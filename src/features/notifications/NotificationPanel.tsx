import { forwardRef, useCallback, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import '../../i18n/config'
import type { NotificationResponse } from '../../api/generated/types'
import { LoadingState } from '../../components/ui/LoadingState'
import { useMarkAllNotificationsRead } from './useMarkAllNotificationsRead'
import { useMarkNotificationRead } from './useMarkNotificationRead'
import './notifications.css'

type NotificationPanelProps = {
  notifications: NotificationResponse[]
  isPending?: boolean
  onClose: () => void
  onAfterMarkAllRead?: () => void
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

export const NotificationPanel = forwardRef<HTMLDivElement, NotificationPanelProps>(
  function NotificationPanel(
    { notifications, isPending = false, onClose, onAfterMarkAllRead },
    ref,
  ) {
    const { t } = useTranslation('layout')
    const navigate = useNavigate()
    const markRead = useMarkNotificationRead()
    const markAllRead = useMarkAllNotificationsRead()
    const panelRef = useRef<HTMLDivElement>(null)
    const firstItemRef = useRef<HTMLButtonElement>(null)
    const markAllButtonRef = useRef<HTMLButtonElement>(null)

    const setPanelRef = useCallback(
      (node: HTMLDivElement | null) => {
        panelRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref],
    )

    useLayoutEffect(() => {
      if (isPending || notifications.length === 0) {
        panelRef.current?.focus()
        return
      }

      const timer = window.setTimeout(() => {
        firstItemRef.current?.focus()
      }, 0)

      return () => window.clearTimeout(timer)
    }, [isPending, notifications])

    async function handleItemClick(notification: NotificationResponse) {
      if (!notification.read) {
        await markRead.mutateAsync(notification.id)
      }
      onClose()
      navigate(notification.linkPath)
    }

    const handleMarkAllRead = useCallback(async () => {
      try {
        await markAllRead.mutateAsync()
        onAfterMarkAllRead?.()
      } catch {
        markAllButtonRef.current?.focus()
      }
    }, [markAllRead, onAfterMarkAllRead])

    return (
      <div
        ref={setPanelRef}
        className="notification-panel"
        data-testid="notification-panel"
        tabIndex={-1}
      >
        <div className="notification-panel-header">
          <span>{t('notifications.label')}</span>
          <button
            ref={markAllButtonRef}
            type="button"
            className="notification-mark-all"
            onClick={() => void handleMarkAllRead()}
            disabled={markAllRead.isPending || notifications.length === 0}
            data-busy={markAllRead.isPending ? 'true' : undefined}
          >
            {t('notifications.markAllRead')}
          </button>
        </div>

        {isPending ? (
          <LoadingState
            label={t('notifications.loading')}
            testId="notification-panel-loading"
            className="notification-empty"
          />
        ) : notifications.length === 0 ? (
          <p className="notification-empty">{t('notifications.empty')}</p>
        ) : (
          <div className="notification-list" role="list">
          {notifications.map((notification, index) => {
            const unread = !notification.read

            return (
              <div key={notification.id} role="listitem">
                <button
                  ref={index === 0 ? firstItemRef : undefined}
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
  },
)
