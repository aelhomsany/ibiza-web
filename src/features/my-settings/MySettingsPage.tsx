import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import '../../i18n/config'
import { useAuth } from '../../auth/useAuth'
import { useToast } from '../../components/ui/useToast'
import { CalendarFeedNotes, CalendarFeedSettings } from '../settings/CalendarFeedSettings'
import { CalendarSyncNotes, CalendarSyncSettings } from '../settings/CalendarSyncSettings'
import { NotificationPreferencesSettings } from '../settings/NotificationPreferencesSettings'
import { SlackLinkNotes, SlackLinkSettings } from '../settings/SlackLinkSettings'
import './my-settings.css'

/**
 * Plan PUENTE D-12 — "My settings", a left-nav item for every org role. The org-wide Settings
 * page is Organization Admin only, so the personal cards live here: Notification preferences, Calendar
 * sync, Calendar feed, and "Your Slack" (shown only once the workspace is installed). Same
 * card stack and notes bands as Settings → Integrations.
 */
export function MySettingsPage() {
  const { t } = useTranslation(['mySettings', 'settings'])
  const { user } = useAuth()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const calendarSyncAnnouncedRef = useRef(false)

  const showSuccessToast = useCallback(
    (message: string) => showToast(message, 'success'),
    [showToast],
  )
  const showWarningToast = useCallback(
    (message: string) => showToast(message, 'warning'),
    [showToast],
  )

  // Google/Microsoft send the browser back through the API's OAuth callback, which redirects
  // here with `?calendarSync=connected|error(&reason=...)`. Announce it once as a toast and
  // strip it so a reload never re-announces it.
  useEffect(() => {
    const outcome = searchParams.get('calendarSync')
    if (outcome == null || calendarSyncAnnouncedRef.current) {
      return
    }
    calendarSyncAnnouncedRef.current = true
    if (outcome === 'connected') {
      showSuccessToast(t('settings:calendarSync.callback.connected'))
    } else {
      showWarningToast(
        searchParams.get('reason') === 'access_denied'
          ? t('settings:calendarSync.callback.accessDenied')
          : t('settings:calendarSync.callback.failed'),
      )
    }
    const next = new URLSearchParams(searchParams)
    next.delete('calendarSync')
    next.delete('reason')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, showSuccessToast, showWarningToast, t])

  if (!user) {
    return null
  }

  return (
    <div className="page page-wide" data-testid="my-settings-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('mySettings:title')}</h1>
          <p className="page-sub">{t('mySettings:subtitle')}</p>
        </div>
      </header>

      <section
        className="my-settings-section"
        aria-labelledby="my-settings-notifications-title"
        data-testid="my-settings-notifications-section"
      >
        <header className="my-settings-section-header">
          <h2 className="my-settings-section-title" id="my-settings-notifications-title">
            {t('mySettings:sections.notifications.title')}
          </h2>
          <p className="my-settings-section-subtitle">
            {t('mySettings:sections.notifications.subtitle')}
          </p>
        </header>
        <NotificationPreferencesSettings onSuccess={showSuccessToast} onWarning={showWarningToast} />
      </section>

      <section
        className="my-settings-section"
        aria-labelledby="my-settings-integrations-title"
        data-testid="my-settings-integrations-section"
      >
        <header className="my-settings-section-header">
          <h2 className="my-settings-section-title" id="my-settings-integrations-title">
            {t('mySettings:sections.integrations.title')}
          </h2>
          <p className="my-settings-section-subtitle">
            {t('mySettings:sections.integrations.subtitle')}
          </p>
        </header>
        <div className="panel-stack" data-testid="my-settings-integrations-panel">
          <div className="panel-group">
            <CalendarSyncSettings onSuccess={showSuccessToast} onWarning={showWarningToast} />
            <div className="support-band">
              <CalendarSyncNotes />
            </div>
          </div>
          <div className="panel-group">
            <CalendarFeedSettings onSuccess={showSuccessToast} onWarning={showWarningToast} />
            <div className="support-band">
              <CalendarFeedNotes />
            </div>
          </div>
          {/* The card wraps its notes so both disappear while no Slack workspace is connected. */}
          <SlackLinkSettings onSuccess={showSuccessToast} onWarning={showWarningToast}>
            <div className="support-band">
              <SlackLinkNotes />
            </div>
          </SlackLinkSettings>
        </div>
      </section>
    </div>
  )
}
