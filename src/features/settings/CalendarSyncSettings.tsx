import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ApiError,
  connectCalendarSync,
  disconnectCalendarSync,
  getCalendarSyncStatus,
  retryCalendarSync,
} from '../../api/client'
import type { CalendarSyncStatusResponse } from '../../api/generated/types'
import { Modal } from '../../components/ui/Modal'
import { CalendarIcon, CloseIcon, RefreshCwIcon } from '../../components/ui/icons'
import './calendar-sync.css'
import './team-members.css'

type CalendarSyncSettingsProps = {
  onSuccess?: (message: string) => void
  onWarning?: (message: string) => void
}

type Provider = CalendarSyncStatusResponse['provider']

function providerKey(provider: Provider) {
  return provider === 'GOOGLE' ? 'calendarSync.providers.google' : 'calendarSync.providers.microsoft'
}

function statusKey(status: CalendarSyncStatusResponse) {
  if (status.status === 'DISCONNECTED') {
    return 'calendarSync.notConnected'
  }
  if (status.status === 'ERROR') {
    return 'calendarSync.connectedError'
  }
  if (status.status === 'REVOKED') {
    return 'calendarSync.needsAttention'
  }
  return 'calendarSync.connected'
}

function mutationMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.problem.detail ?? fallback
  }
  return fallback
}

export function CalendarSyncSettings({
  onSuccess,
  onWarning,
}: CalendarSyncSettingsProps) {
  const { t } = useTranslation(['settings', 'common'])
  const queryClient = useQueryClient()
  const [disconnectTarget, setDisconnectTarget] = useState<Provider | null>(null)
  const queryKey = ['calendar-sync', 'status'] as const

  const statusQuery = useQuery({
    queryKey,
    queryFn: getCalendarSyncStatus,
  })

  const connectMutation = useMutation({
    mutationFn: (provider: Provider) => connectCalendarSync(provider),
    onSuccess: (response) => {
      window.location.assign(response.authorizationUrl)
    },
    onError: (error) => onWarning?.(mutationMessage(error, t('settings:calendarSync.errors.connect'))),
  })

  const retryMutation = useMutation({
    mutationFn: (provider: Provider) => retryCalendarSync(provider),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
      onSuccess?.(t('settings:calendarSync.success.retry'))
    },
    onError: (error) => onWarning?.(mutationMessage(error, t('settings:calendarSync.errors.retry'))),
  })

  const disconnectMutation = useMutation({
    mutationFn: (provider: Provider) => disconnectCalendarSync(provider),
    onSuccess: () => {
      setDisconnectTarget(null)
      void queryClient.invalidateQueries({ queryKey })
      onSuccess?.(t('settings:calendarSync.success.disconnected'))
    },
    onError: (error) => onWarning?.(mutationMessage(error, t('settings:calendarSync.errors.disconnect'))),
  })

  if (statusQuery.isPending) {
    return (
      <section className="settings-card settings-card-spaced" data-testid="calendar-sync-settings">
        <div className="card-section-header">
          <span className="card-section-title">{t('settings:calendarSync.title')}</span>
        </div>
        <p className="settings-card-loading-inline">{t('settings:calendarSync.loading')}</p>
      </section>
    )
  }

  if (statusQuery.isError) {
    return (
      <section className="settings-card settings-card-spaced" data-testid="calendar-sync-settings">
        <div className="card-section-header">
          <span className="card-section-title">{t('settings:calendarSync.title')}</span>
        </div>
        <p className="settings-card-error-inline">{t('settings:calendarSync.errors.load')}</p>
      </section>
    )
  }

  const providers = statusQuery.data
  const railProvider = providers[0]?.provider ?? 'GOOGLE'

  return (
    <div className="panel-with-aside">
      <section className="settings-card settings-card-spaced" data-testid="calendar-sync-settings">
        <div className="card-section-header">
          <span className="card-section-title">{t('settings:calendarSync.title')}</span>
        </div>
        <ul className="calendar-sync-rows">
          {providers.map((status) => {
            const provider = status.provider
            const id = provider.toLowerCase()
            const disconnected = status.status === 'DISCONNECTED'
            const needsReconnect = status.status === 'REVOKED'
            const canRetry = status.status === 'ERROR' || status.failedEventCount > 0
            const hasError = status.status === 'ERROR' || needsReconnect
            const busy =
              (connectMutation.isPending && connectMutation.variables === provider) ||
              (retryMutation.isPending && retryMutation.variables === provider)
            return (
              <li className="calendar-sync-body" key={provider} data-testid={`calendar-sync-row-${id}`}>
                <div className="calendar-sync-icon" aria-hidden="true">
                  <CalendarIcon size={20} />
                </div>
                <div className="calendar-sync-copy">
                  <p className="calendar-sync-title">{t(`settings:${providerKey(provider)}`)}</p>
                  <p className="calendar-sync-status" data-testid={`calendar-sync-status-${id}`}>
                    {t(`settings:${statusKey(status)}`)}
                    {status.accountEmail ? ` · ${status.accountEmail}` : ''}
                  </p>
                  {hasError && (
                    <p className="calendar-sync-warning">
                      {t('settings:calendarSync.statusWarning', {
                        category: status.lastErrorCategory ?? t('common:unknown'),
                      })}
                    </p>
                  )}
                  {status.pendingEventCount > 0 && (
                    <p className="calendar-sync-meta" data-testid={`calendar-sync-pending-${id}`}>
                      {t('settings:calendarSync.pendingEvents', { count: status.pendingEventCount })}
                    </p>
                  )}
                  {status.failedEventCount > 0 && (
                    <p className="calendar-sync-warning" data-testid={`calendar-sync-failed-${id}`}>
                      {t('settings:calendarSync.failedEvents', { count: status.failedEventCount })}
                    </p>
                  )}
                </div>
                <div className="calendar-sync-actions">
                  {(disconnected || needsReconnect) && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => connectMutation.mutate(provider)}
                      disabled={busy}
                      data-busy={busy ? 'true' : undefined}
                      data-testid={`calendar-sync-connect-${id}`}
                    >
                      <CalendarIcon size={14} /> {t('settings:calendarSync.actions.connect')}
                    </button>
                  )}
                  {!disconnected && canRetry && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => retryMutation.mutate(provider)}
                      disabled={busy}
                      data-busy={busy ? 'true' : undefined}
                      data-testid={`calendar-sync-retry-${id}`}
                    >
                      <RefreshCwIcon size={14} /> {t('settings:calendarSync.actions.retry')}
                    </button>
                  )}
                  {!disconnected && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setDisconnectTarget(provider)}
                      disabled={disconnectMutation.isPending}
                      data-testid={`calendar-sync-disconnect-${id}`}
                    >
                      <CloseIcon size={14} /> {t('settings:calendarSync.actions.disconnect')}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        {disconnectTarget && (
          <Modal
            labelledBy="calendar-sync-disconnect-title"
            onClose={() => setDisconnectTarget(null)}
            closeOnBackdrop={false}
            testId="calendar-sync-disconnect-modal"
          >
            <div className="modal-header">
              <h2 className="modal-title" id="calendar-sync-disconnect-title">
                {t('settings:calendarSync.disconnectTitle')}
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDisconnectTarget(null)}
                aria-label={t('common:actions.close')}
                disabled={disconnectMutation.isPending}
              >
                <CloseIcon size={18} />
              </button>
            </div>
            <p className="calendar-sync-modal-copy">
              {t('settings:calendarSync.disconnectCopy', {
                provider: t(`settings:${providerKey(disconnectTarget)}`),
              })}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDisconnectTarget(null)}
                disabled={disconnectMutation.isPending}
              >
                {t('common:actions.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => disconnectMutation.mutate(disconnectTarget)}
                disabled={disconnectMutation.isPending}
                data-busy={disconnectMutation.isPending ? 'true' : undefined}
              >
                {t('settings:calendarSync.actions.confirmDisconnect')}
              </button>
            </div>
          </Modal>
        )}
      </section>

      <aside className="support-rail">
        {/* Connect is an outward-facing OAuth grant, so what the connection then writes belongs
            next to the button rather than behind it. Each bullet is what CalendarSyncWorker
            actually does: approved leave only, active people only, one event titled
            "<leave type> - <person>" on the connected account's own calendar, removed again
            when the request is declined (Plan PUENTE D-2). */}
        <section className="support-note" aria-labelledby="calendar-sync-syncs-title">
          <h3 className="support-note-title" id="calendar-sync-syncs-title">
            {t('settings:calendarSync.rail.syncsTitle')}
          </h3>
          <ul className="support-note-bullets">
            <li>{t('settings:calendarSync.rail.syncsApproved')}</li>
            <li>{t('settings:calendarSync.rail.syncsTitleField')}</li>
            <li>{t('settings:calendarSync.rail.syncsOwnCalendar')}</li>
            <li>{t('settings:calendarSync.rail.syncsDeclineRemoves')}</li>
          </ul>
        </section>

        {/* The same sentence the disconnect dialog shows — it is the answer to "what do I lose?",
            which is a question asked before connecting, not only while disconnecting. */}
        <section className="support-note" aria-labelledby="calendar-sync-disconnect-title-note">
          <h3 className="support-note-title" id="calendar-sync-disconnect-title-note">
            {t('settings:calendarSync.rail.disconnectingTitle')}
          </h3>
          <p className="support-note-body">
            {t('settings:calendarSync.disconnectCopy', {
              provider: t(`settings:${providerKey(railProvider)}`),
            })}
          </p>
          <p className="support-note-body">{t('settings:calendarSync.retryHint')}</p>
        </section>
      </aside>
    </div>
  )
}
