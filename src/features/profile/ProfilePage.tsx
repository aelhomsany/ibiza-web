import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import '../../i18n/config'
import { ApiError, removeProfileImage, uploadProfileImage } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'
import { useToast } from '../../components/ui/useToast'
import { isSupportedLocale } from '../../i18n/documentLanguage'
import { CalendarFeedNotes, CalendarFeedSettings } from '../settings/CalendarFeedSettings'
import { CalendarSyncNotes, CalendarSyncSettings } from '../settings/CalendarSyncSettings'
import { NotificationPreferencesSettings } from '../settings/NotificationPreferencesSettings'
import { SlackLinkNotes, SlackLinkSettings } from '../settings/SlackLinkSettings'
import { ProfileAvatar } from './ProfileAvatar'
import './profile-page.css'

export function ProfilePage() {
  const { t } = useTranslation(['profile', 'layout', 'common', 'settings'])
  const { user, refreshUser } = useAuth()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const calendarSyncAnnouncedRef = useRef(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  const showSuccessToast = useCallback(
    (message: string) => showToast(message, 'success'),
    [showToast],
  )
  const showWarningToast = useCallback(
    (message: string) => showToast(message, 'warning'),
    [showToast],
  )

  // Google/Microsoft send the browser back through the API's OAuth callback, which redirects
  // here with `?calendarSync=connected|error(&reason=...)` (Plan PUENTE D-12: the personal
  // integrations live on the Profile page so every role can reach them). Announce it once as
  // a toast and strip it so a reload never re-announces it.
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

  // Platform Admins have no leave workflow, calendar, or Slack of their own.
  const showPersonalSections = user.role !== 'PLATFORM_ADMIN'

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    setIsUploading(true)
    try {
      await uploadProfileImage(file)
      await refreshUser()
      showToast(t('profile:success.updated'), 'success')
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.problem.detail ?? t('profile:errors.upload')
          : t('profile:errors.upload')
      showToast(message, 'warning')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleConfirmRemove() {
    setIsRemoving(true)
    try {
      await removeProfileImage()
      await refreshUser()
      setRemoveOpen(false)
      showToast(t('profile:success.removed'), 'success')
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.problem.detail ?? t('profile:errors.remove')
          : t('profile:errors.remove')
      showToast(message, 'warning')
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="page page-wide" data-testid="profile-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('profile:title')}</h1>
          <p className="page-sub">{t('profile:subtitle')}</p>
        </div>
      </header>

      <div className="profile-layout">
        <section className="settings-card profile-summary-card" aria-label={t('profile:summary')}>
          <div className="card-section-header">
            <h2 className="card-title">{t('profile:account')}</h2>
          </div>
          <dl className="profile-summary-list">
            <div className="profile-summary-row">
              <dt>{t('profile:fields.name')}</dt>
              <dd dir="auto">{user.fullName}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>{t('profile:fields.email')}</dt>
              <dd dir="auto">{user.email}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>{t('profile:fields.role')}</dt>
              <dd>{t(`common:roles.${roleKey(user.role)}`)}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>{t('profile:fields.workforceGroup')}</dt>
              <dd>{user.workforceGroupName?.trim() || t('common:profile.notApplicable')}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>{t('profile:fields.timezone')}</dt>
              <dd>{user.timezone?.trim() || t('common:profile.notApplicable')}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>{t('profile:fields.preferredLanguage')}</dt>
              <dd>
                {isSupportedLocale(user.preferredLanguage)
                  ? t(`layout:language.${user.preferredLanguage}`)
                  : t('common:profile.languageNotSet')}
              </dd>
            </div>
          </dl>
        </section>

        <section className="settings-card profile-image-card" aria-label={t('profile:photo.summary')}>
          <div className="card-section-header">
            <h2 className="card-title">{t('profile:photo.title')}</h2>
          </div>
          <div className="profile-image-body">
            <ProfileAvatar
              fullName={user.fullName}
              profileImageUrl={user.profileImageUrl}
              size="lg"
            />
            <div className="profile-image-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                data-testid="profile-image-input"
                onChange={(event) => void handleFileChange(event)}
              />
              <button
                type="button"
                className="btn btn-outline"
                disabled={isUploading || isRemoving}
                data-busy={isUploading ? 'true' : undefined}
                onClick={() => fileInputRef.current?.click()}
              >
                {user.profileImageUrl ? t('profile:actions.replace') : t('profile:actions.upload')}
              </button>
              {user.profileImageUrl ? (
                <button
                  type="button"
                  className="btn btn-outline"
                  data-testid="profile-image-remove-btn"
                  disabled={isUploading || isRemoving}
                  onClick={() => setRemoveOpen(true)}
                >
                  {t('profile:actions.remove')}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {showPersonalSections ? (
        <>
          <section
            className="profile-section"
            aria-labelledby="profile-notifications-title"
            data-testid="profile-notifications-section"
          >
            <header className="profile-section-header">
              <h2 className="profile-section-title" id="profile-notifications-title">
                {t('profile:sections.notifications.title')}
              </h2>
              <p className="profile-section-subtitle">{t('profile:sections.notifications.subtitle')}</p>
            </header>
            <NotificationPreferencesSettings
              onSuccess={showSuccessToast}
              onWarning={showWarningToast}
            />
          </section>

          <section
            className="profile-section"
            aria-labelledby="profile-integrations-title"
            data-testid="profile-integrations-section"
          >
            <header className="profile-section-header">
              <h2 className="profile-section-title" id="profile-integrations-title">
                {t('profile:sections.integrations.title')}
              </h2>
              <p className="profile-section-subtitle">{t('profile:sections.integrations.subtitle')}</p>
            </header>
            <div className="panel-stack" data-testid="profile-integrations-panel">
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
              <SlackLinkGroup onSuccess={showSuccessToast} onWarning={showWarningToast} />
            </div>
          </section>
        </>
      ) : null}

      {removeOpen ? (
        <Modal
          labelledBy="profile-remove-title"
          onClose={() => setRemoveOpen(false)}
          closeOnBackdrop={false}
          testId="profile-remove-modal"
        >
          <div className="modal-header">
            <h2 className="modal-title" id="profile-remove-title">
              {t('profile:photo.removeTitle')}
            </h2>
            <button
              type="button"
              className="modal-close"
              onClick={() => setRemoveOpen(false)}
              aria-label={t('common:actions.close')}
              disabled={isRemoving}
            >
              <CloseIcon size={18} />
            </button>
          </div>
          <div className="modal-body">
            <p className="body-text">{t('profile:photo.removeCopy')}</p>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setRemoveOpen(false)}
              disabled={isRemoving}
            >
              {t('common:actions.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              data-testid="profile-image-remove-confirm-btn"
              disabled={isRemoving}
              data-busy={isRemoving ? 'true' : undefined}
              onClick={() => void handleConfirmRemove()}
            >
              {t('profile:actions.remove')}
            </button>
          </div>
        </Modal>
      ) : null}

    </div>
  )
}

/**
 * The personal Slack card and its notes as one group, so the notes disappear together with the
 * card when the organization has no Slack workspace connected.
 */
function SlackLinkGroup({
  onSuccess,
  onWarning,
}: {
  onSuccess: (message: string) => void
  onWarning: (message: string) => void
}) {
  return (
    <SlackLinkSettings onSuccess={onSuccess} onWarning={onWarning}>
      <div className="support-band">
        <SlackLinkNotes />
      </div>
    </SlackLinkSettings>
  )
}

function roleKey(role: string): string {
  if (role === 'HR_ADMIN') return 'hrAdmin'
  if (role === 'PLATFORM_ADMIN') return 'platformAdmin'
  return role.toLowerCase()
}
