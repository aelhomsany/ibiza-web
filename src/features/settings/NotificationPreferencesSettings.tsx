import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ApiError,
  getNotificationPreferences,
  updateNotificationPreference,
} from '../../api/client'
import type {
  NotificationPreferenceResponse,
  UpdateNotificationPreferenceRequest,
} from '../../api/generated/types'
import { BellIcon } from '../../components/ui/icons'
import './notification-preferences.css'

type NotificationPreferencesProps = {
  onSuccess?: (message: string) => void
  onWarning?: (message: string) => void
}

type MutePreset = '1_HOUR' | '1_DAY' | '1_WEEK'

const MUTE_PRESETS: { value: MutePreset; labelKey: string; ms: number }[] = [
  { value: '1_HOUR', labelKey: 'notifications.presets.hour', ms: 60 * 60 * 1000 },
  { value: '1_DAY', labelKey: 'notifications.presets.day', ms: 24 * 60 * 60 * 1000 },
  { value: '1_WEEK', labelKey: 'notifications.presets.week', ms: 7 * 24 * 60 * 60 * 1000 },
]

function findChannel(
  preferences: NotificationPreferenceResponse[] | undefined,
  channel: NotificationPreferenceResponse['channel'],
) {
  return preferences?.find((preference) => preference.channel === channel)
}

function mutedUntilFromPreset(preset: MutePreset): string {
  const { ms } = MUTE_PRESETS.find((option) => option.value === preset) ?? MUTE_PRESETS[1]
  return new Date(Date.now() + ms).toISOString()
}

function mutationMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.problem.detail ?? fallback
  }
  return fallback
}

function emailStatusKey(enabled: boolean, mutedUntil: string | null): string {
  if (!enabled) {
    return 'notifications.status.off'
  }
  if (mutedUntil && new Date(mutedUntil).getTime() > Date.now()) {
    return 'notifications.status.muted'
  }
  return 'notifications.status.on'
}

export function NotificationPreferencesSettings({
  onSuccess,
  onWarning,
}: NotificationPreferencesProps) {
  const { t, i18n } = useTranslation('settings')
  const queryClient = useQueryClient()
  const queryKey = ['notification-preferences'] as const

  const preferencesQuery = useQuery({
    queryKey,
    queryFn: getNotificationPreferences,
  })

  const emailPref = findChannel(preferencesQuery.data, 'EMAIL')
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [emailMutedUntil, setEmailMutedUntil] = useState<string | null>(null)
  const [emailDirty, setEmailDirty] = useState(false)
  const [mutePreset, setMutePreset] = useState<MutePreset>('1_DAY')

  function syncFromServer(pref: NotificationPreferenceResponse) {
    setEmailEnabled(pref.enabled)
    setEmailMutedUntil(pref.mutedUntil ?? null)
    setEmailDirty(false)
  }

  // Keep the editable email controls in sync with the server-authoritative preference, but never
  // clobber an unsaved local edit (e.g. from a background refetch on window focus).
  useEffect(() => {
    if (emailPref && !emailDirty) {
      setEmailEnabled(emailPref.enabled)
      setEmailMutedUntil(emailPref.mutedUntil ?? null)
    }
  }, [emailPref, emailDirty])

  const updateMutation = useMutation({
    mutationFn: (variables: {
      payload: UpdateNotificationPreferenceRequest
      successMessage: string
    }) => updateNotificationPreference(variables.payload),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(queryKey, data)
      setEmailDirty(false)
      onSuccess?.(variables.successMessage)
    },
    onError: (error) => {
      // A rejected update must not leave the UI showing an edit that was never persisted.
      if (emailPref) {
        syncFromServer(emailPref)
      }
      onWarning?.(mutationMessage(error, t('notifications.errors.update')))
    },
  })

  function saveEmailPreference() {
    updateMutation.mutate({
      payload: {
        channel: 'EMAIL',
        scope: 'WORKFLOW',
        enabled: emailEnabled,
        mutedUntil: emailMutedUntil,
      },
      successMessage: t('notifications.success.saved'),
    })
  }

  function muteEmail() {
    updateMutation.mutate({
      payload: {
        channel: 'EMAIL',
        scope: 'WORKFLOW',
        enabled: emailEnabled,
        mutedUntil: mutedUntilFromPreset(mutePreset),
      },
      successMessage: t('notifications.success.muted'),
    })
  }

  function clearEmailMute() {
    updateMutation.mutate({
      payload: {
        channel: 'EMAIL',
        scope: 'WORKFLOW',
        enabled: emailEnabled,
        mutedUntil: null,
      },
      successMessage: t('notifications.success.cleared'),
    })
  }

  if (preferencesQuery.isPending) {
    return (
      <section
        className="settings-card settings-card-spaced"
        data-testid="notification-preferences-settings"
      >
        <div className="card-section-header">
          <span className="card-section-title">{t('notifications.title')}</span>
        </div>
        <p className="settings-card-loading-inline">{t('notifications.loading')}</p>
      </section>
    )
  }

  if (preferencesQuery.isError) {
    return (
      <section
        className="settings-card settings-card-spaced"
        data-testid="notification-preferences-settings"
      >
        <div className="card-section-header">
          <span className="card-section-title">{t('notifications.title')}</span>
        </div>
        <p className="settings-card-error-inline">{t('notifications.errors.load')}</p>
      </section>
    )
  }

  const saving = updateMutation.isPending

  return (
    <section
      className="settings-card settings-card-spaced"
      data-testid="notification-preferences-settings"
    >
      <div className="card-section-header">
        <span className="card-section-title">
          <BellIcon size={18} /> {t('notifications.title')}
        </span>
      </div>
      <p className="notification-pref-intro">
        {t('notifications.intro')}
      </p>

      <div
        className="notification-pref-row"
        data-testid="notification-preference-in-app-workflow"
      >
        <div className="notification-pref-main">
          <label className="notification-pref-toggle">
            <input type="checkbox" checked disabled />
            <span>{t('notifications.inApp')}</span>
          </label>
          <span className="notification-pref-badge notification-pref-badge-required">
            {t('notifications.badges.required')}
          </span>
        </div>
        <p className="notification-pref-help">
          {t('notifications.inAppHelp')}
        </p>
      </div>

      <div
        className="notification-pref-row"
        data-testid="notification-preference-email-workflow"
      >
        <div className="notification-pref-main">
          <label className="notification-pref-toggle">
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(event) => {
                setEmailEnabled(event.target.checked)
                setEmailDirty(true)
              }}
            />
            <span>{t('notifications.email')}</span>
          </label>
          <span className="notification-pref-badge notification-pref-badge-optional">
            {t('notifications.badges.optional')}
          </span>
        </div>
        <p className="notification-pref-help" data-testid="notification-preference-email-status">
          {t(emailStatusKey(emailEnabled, emailMutedUntil), {
            date: emailMutedUntil ? new Date(emailMutedUntil).toLocaleString(i18n.language) : '',
          })}
        </p>

        <div className="notification-pref-mute">
          <label htmlFor="mute-email-select">{t('notifications.muteFor')}</label>
          <select
            id="mute-email-select"
            value={mutePreset}
            onChange={(event) => setMutePreset(event.target.value as MutePreset)}
          >
            {MUTE_PRESETS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={muteEmail}
            disabled={saving}
            data-busy={saving ? 'true' : undefined}
          >
            {t('notifications.actions.mute')}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={clearEmailMute}
            disabled={saving}
            data-busy={saving ? 'true' : undefined}
          >
            {t('notifications.actions.clearMute')}
          </button>
        </div>

        <div className="notification-pref-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={saveEmailPreference}
            disabled={saving}
            data-busy={saving ? 'true' : undefined}
          >
            {t('notifications.actions.save')}
          </button>
        </div>
      </div>
    </section>
  )
}
