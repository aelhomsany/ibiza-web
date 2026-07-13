import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
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

const MUTE_PRESETS: { value: MutePreset; label: string; ms: number }[] = [
  { value: '1_HOUR', label: '1 hour', ms: 60 * 60 * 1000 },
  { value: '1_DAY', label: '1 day', ms: 24 * 60 * 60 * 1000 },
  { value: '1_WEEK', label: '1 week', ms: 7 * 24 * 60 * 60 * 1000 },
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

function emailStatusText(enabled: boolean, mutedUntil: string | null): string {
  if (!enabled) {
    return 'Email workflow notifications are turned off.'
  }
  if (mutedUntil && new Date(mutedUntil).getTime() > Date.now()) {
    return `Email workflow notifications are muted until ${new Date(mutedUntil).toLocaleString()}.`
  }
  return 'Email workflow notifications are on.'
}

export function NotificationPreferencesSettings({
  onSuccess,
  onWarning,
}: NotificationPreferencesProps) {
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
      onWarning?.(mutationMessage(error, 'Unable to update notification preferences'))
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
      successMessage: 'Notification preferences saved',
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
      successMessage: 'Email notifications muted',
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
      successMessage: 'Email mute cleared',
    })
  }

  if (preferencesQuery.isPending) {
    return (
      <section
        className="settings-card settings-card-spaced"
        data-testid="notification-preferences-settings"
      >
        <div className="card-section-header">
          <span className="card-section-title">Notification Preferences</span>
        </div>
        <p className="settings-card-loading-inline">Loading notification preferences…</p>
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
          <span className="card-section-title">Notification Preferences</span>
        </div>
        <p className="settings-card-error-inline">Unable to load notification preferences.</p>
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
          <BellIcon size={18} /> Notification Preferences
        </span>
      </div>
      <p className="notification-pref-intro">
        Tune how you receive leave workflow updates. Critical workflow notifications always stay on
        in at least one channel.
      </p>

      <div
        className="notification-pref-row"
        data-testid="notification-preference-in-app-workflow"
      >
        <div className="notification-pref-main">
          <label className="notification-pref-toggle">
            <input type="checkbox" checked disabled />
            <span>In-app workflow notifications</span>
          </label>
          <span className="notification-pref-badge notification-pref-badge-required">
            Required
          </span>
        </div>
        <p className="notification-pref-help">
          Always on so leave workflow accountability stays visible in the app.
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
            <span>Email workflow notifications</span>
          </label>
          <span className="notification-pref-badge notification-pref-badge-optional">
            Optional
          </span>
        </div>
        <p className="notification-pref-help" data-testid="notification-preference-email-status">
          {emailStatusText(emailEnabled, emailMutedUntil)}
        </p>

        <div className="notification-pref-mute">
          <label htmlFor="mute-email-select">Mute email workflow for</label>
          <select
            id="mute-email-select"
            value={mutePreset}
            onChange={(event) => setMutePreset(event.target.value as MutePreset)}
          >
            {MUTE_PRESETS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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
            Mute Email
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={clearEmailMute}
            disabled={saving}
            data-busy={saving ? 'true' : undefined}
          >
            Clear Mute
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
            Save Preferences
          </button>
        </div>
      </div>
    </section>
  )
}
