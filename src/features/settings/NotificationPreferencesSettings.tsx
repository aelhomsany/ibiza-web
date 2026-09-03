import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ApiError,
  getNotificationPreferences,
  getSlackStatus,
  updateNotificationPreference,
} from '../../api/client'
import type {
  NotificationPreferenceResponse,
  UpdateNotificationPreferenceRequest,
} from '../../api/generated/types'
import { BellIcon } from '../../components/ui/icons'
import './notification-preferences.css'

type NotificationPreferencesProps = {
  discardSignal?: number
  onDirtyChange?: (dirty: boolean) => void
  onSuccess?: (message: string) => void
  onWarning?: (message: string) => void
}

type MutePreset = '1_HOUR' | '1_DAY' | '1_WEEK'

const MUTE_PRESETS: { value: MutePreset; labelKey: string; ms: number }[] = [
  { value: '1_HOUR', labelKey: 'notifications.presets.hour', ms: 60 * 60 * 1000 },
  { value: '1_DAY', labelKey: 'notifications.presets.day', ms: 24 * 60 * 60 * 1000 },
  { value: '1_WEEK', labelKey: 'notifications.presets.week', ms: 7 * 24 * 60 * 60 * 1000 },
]

/** The channels a person can turn off or mute; IN_APP is mandatory and rendered read-only. */
type MutableChannel = 'EMAIL' | 'SLACK'
const MUTABLE_CHANNELS: MutableChannel[] = ['EMAIL', 'SLACK']

type Draft = { enabled: boolean; mutedUntil: string | null; dirty: boolean }
type Drafts = Record<MutableChannel, Draft>

const EMPTY_DRAFT: Draft = { enabled: true, mutedUntil: null, dirty: false }

// Must match the key in SlackWorkspaceSettings so a disconnect there refreshes this card.
const SLACK_STATUS_QUERY_KEY = ['slack-status'] as const

const CHANNEL_COPY: Record<
  MutableChannel,
  {
    testId: string
    selectId: string
    label: string
    muteFor: string
    status: string
    actions: { mute: string; clearMute: string; save: string }
    success: { muted: string; cleared: string }
  }
> = {
  EMAIL: {
    testId: 'email',
    selectId: 'mute-email-select',
    label: 'notifications.email',
    muteFor: 'notifications.muteFor',
    status: 'notifications.status',
    actions: {
      mute: 'notifications.actions.mute',
      clearMute: 'notifications.actions.clearMute',
      save: 'notifications.actions.save',
    },
    success: { muted: 'notifications.success.muted', cleared: 'notifications.success.cleared' },
  },
  SLACK: {
    testId: 'slack',
    selectId: 'mute-slack-select',
    label: 'notifications.slack',
    muteFor: 'notifications.muteSlackFor',
    status: 'notifications.slackStatus',
    actions: {
      mute: 'notifications.actions.muteSlack',
      clearMute: 'notifications.actions.clearSlackMute',
      save: 'notifications.actions.saveSlack',
    },
    success: {
      muted: 'notifications.success.slackMuted',
      cleared: 'notifications.success.slackCleared',
    },
  },
}

function findChannel(
  preferences: NotificationPreferenceResponse[] | undefined,
  channel: NotificationPreferenceResponse['channel'],
) {
  return preferences?.find((preference) => preference.channel === channel)
}

function draftFromServer(pref: NotificationPreferenceResponse | undefined): Draft {
  return pref ? { enabled: pref.enabled, mutedUntil: pref.mutedUntil ?? null, dirty: false } : EMPTY_DRAFT
}

function draftsFromServer(preferences: NotificationPreferenceResponse[] | undefined): Drafts {
  return {
    EMAIL: draftFromServer(findChannel(preferences, 'EMAIL')),
    SLACK: draftFromServer(findChannel(preferences, 'SLACK')),
  }
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

function statusSuffix(enabled: boolean, mutedUntil: string | null): 'off' | 'muted' | 'on' {
  if (!enabled) {
    return 'off'
  }
  if (mutedUntil && new Date(mutedUntil).getTime() > Date.now()) {
    return 'muted'
  }
  return 'on'
}

export function NotificationPreferencesSettings({
  discardSignal = 0,
  onDirtyChange,
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

  // Plan PUENTE B6: the Slack row only makes sense once the organization's Slack app is installed.
  // Until then the server-side SLACK preference still exists (fail-open) but is not shown.
  const slackStatusQuery = useQuery({
    queryKey: SLACK_STATUS_QUERY_KEY,
    queryFn: getSlackStatus,
  })
  const slackWorkspaceConnected = slackStatusQuery.data?.workspaceConnected === true

  const preferences = preferencesQuery.data
  const [drafts, setDrafts] = useState<Drafts>({ EMAIL: EMPTY_DRAFT, SLACK: EMPTY_DRAFT })
  const [mutePresets, setMutePresets] = useState<Record<MutableChannel, MutePreset>>({
    EMAIL: '1_DAY',
    SLACK: '1_DAY',
  })
  const lastDiscardSignal = useRef(discardSignal)
  const anyDirty = MUTABLE_CHANNELS.some((channel) => drafts[channel].dirty)

  // Keep the editable controls in sync with the server-authoritative preference, but never
  // clobber an unsaved local edit (e.g. from a background refetch on window focus).
  useEffect(() => {
    setDrafts((previous) => {
      let next = previous
      for (const channel of MUTABLE_CHANNELS) {
        const pref = findChannel(preferences, channel)
        if (!pref || previous[channel].dirty) {
          continue
        }
        const fromServer = draftFromServer(pref)
        if (
          fromServer.enabled !== previous[channel].enabled ||
          fromServer.mutedUntil !== previous[channel].mutedUntil
        ) {
          next = { ...next, [channel]: fromServer }
        }
      }
      return next
    })
  }, [preferences])

  useEffect(() => {
    onDirtyChange?.(anyDirty)
  }, [anyDirty, onDirtyChange])

  // Unmounting (e.g. a category switch right after Discard) must not leave the
  // parent's dirty flag stuck true — nothing else will ever clear it once this
  // component is gone.
  useEffect(
    () => () => {
      onDirtyChange?.(false)
    },
    [onDirtyChange],
  )

  useEffect(() => {
    if (lastDiscardSignal.current === discardSignal) {
      return
    }
    lastDiscardSignal.current = discardSignal
    // Reset unconditionally: if the preferences haven't loaded yet this clears the dirty flags and
    // the sync-from-server effect above fills the fields in once they arrive.
    setDrafts(draftsFromServer(preferences))
  }, [discardSignal, preferences])

  const updateMutation = useMutation({
    mutationFn: (variables: {
      channel: MutableChannel
      payload: UpdateNotificationPreferenceRequest
      successMessage: string
    }) => updateNotificationPreference(variables.payload),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(queryKey, data)
      setDrafts((previous) => ({
        ...previous,
        [variables.channel]: draftFromServer(findChannel(data, variables.channel)),
      }))
      onSuccess?.(variables.successMessage)
    },
    onError: (error, variables) => {
      // A rejected update must not leave the UI showing an edit that was never persisted.
      setDrafts((previous) => ({
        ...previous,
        [variables.channel]: draftFromServer(findChannel(preferences, variables.channel)),
      }))
      onWarning?.(mutationMessage(error, t('notifications.errors.update')))
    },
  })

  function save(channel: MutableChannel, mutedUntil: string | null, successMessage: string) {
    updateMutation.mutate({
      channel,
      payload: { channel, scope: 'WORKFLOW', enabled: drafts[channel].enabled, mutedUntil },
      successMessage,
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

  const renderMutableRow = (channel: MutableChannel) => {
    const copy = CHANNEL_COPY[channel]
    const draft = drafts[channel]
    return (
      <div
        className="notification-pref-row"
        data-testid={`notification-preference-${copy.testId}-workflow`}
        key={channel}
      >
        <div className="notification-pref-main">
          <label className="notification-pref-toggle">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => {
                const enabled = event.target.checked
                setDrafts((previous) => ({
                  ...previous,
                  [channel]: { ...previous[channel], enabled, dirty: true },
                }))
              }}
            />
            <span>{t(copy.label)}</span>
          </label>
          <span className="notification-pref-badge notification-pref-badge-optional">
            {t('notifications.badges.optional')}
          </span>
        </div>
        <p
          className="notification-pref-help"
          data-testid={`notification-preference-${copy.testId}-status`}
        >
          {t(`${copy.status}.${statusSuffix(draft.enabled, draft.mutedUntil)}`, {
            date: draft.mutedUntil ? new Date(draft.mutedUntil).toLocaleString(i18n.language) : '',
          })}
        </p>

        <div className="notification-pref-mute">
          <label htmlFor={copy.selectId}>{t(copy.muteFor)}</label>
          <select
            id={copy.selectId}
            value={mutePresets[channel]}
            onChange={(event) =>
              setMutePresets((previous) => ({
                ...previous,
                [channel]: event.target.value as MutePreset,
              }))
            }
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
            onClick={() => save(channel, mutedUntilFromPreset(mutePresets[channel]), t(copy.success.muted))}
            disabled={saving}
            data-busy={saving ? 'true' : undefined}
          >
            {t(copy.actions.mute)}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => save(channel, null, t(copy.success.cleared))}
            disabled={saving}
            data-busy={saving ? 'true' : undefined}
          >
            {t(copy.actions.clearMute)}
          </button>
        </div>

        <div className="notification-pref-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => save(channel, draft.mutedUntil, t('notifications.success.saved'))}
            disabled={saving || !draft.dirty}
            data-busy={saving ? 'true' : undefined}
          >
            {t(copy.actions.save)}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="panel-with-aside">
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

        {renderMutableRow('EMAIL')}
        {slackWorkspaceConnected && findChannel(preferences, 'SLACK') && renderMutableRow('SLACK')}
      </section>

      <aside className="support-rail">
        {/* Two toggles and a mute duration say nothing about what is actually being tuned. These
            are the workflow messages the server sends (NotificationType), phrased from the
            recipient's side because that is who is reading this panel. */}
        <section className="support-note" aria-labelledby="notifications-sent-title">
          <h3 className="support-note-title" id="notifications-sent-title">
            {t('notifications.rail.sentTitle')}
          </h3>
          <ul className="support-note-bullets">
            <li>{t('notifications.rail.sentApproval')}</li>
            <li>{t('notifications.rail.sentDecision')}</li>
            <li>{t('notifications.rail.sentConcern')}</li>
            <li>{t('notifications.rail.sentComplete')}</li>
          </ul>
        </section>

        <section className="support-note" aria-labelledby="notifications-scope-title">
          <h3 className="support-note-title" id="notifications-scope-title">
            {t('notifications.rail.scopeTitle')}
          </h3>
          <p className="support-note-body">{t('notifications.rail.scopeYours')}</p>
          <p className="support-note-body">{t('notifications.rail.scopeRequired')}</p>
          {/* The server caps a mute at 30 days and rejects anything longer; the presets stop at a
              week, so nothing on the left ever mentions the ceiling. */}
          <p className="support-note-body">{t('notifications.rail.scopeMuteCap')}</p>
          <p className="support-note-body">{t('notifications.rail.scopeSlack')}</p>
        </section>
      </aside>
    </div>
  )
}
