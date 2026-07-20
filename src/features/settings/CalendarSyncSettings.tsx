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

function providerKey(provider: CalendarSyncStatusResponse['provider']) {
  return provider === 'GOOGLE' ? 'calendarSync.providers.google' : 'calendarSync.providers.microsoft'
}

function statusKey(status?: CalendarSyncStatusResponse) {
  if (!status || !status.connected) {
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
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false)
  const queryKey = ['calendar-sync', 'status'] as const

  const statusQuery = useQuery({
    queryKey,
    queryFn: getCalendarSyncStatus,
  })

  const status = statusQuery.data
  const provider = status?.provider ?? 'GOOGLE'

  const connectMutation = useMutation({
    mutationFn: () => connectCalendarSync(provider),
    onSuccess: (response) => {
      window.location.assign(response.authorizationUrl)
    },
    onError: (error) => onWarning?.(mutationMessage(error, t('settings:calendarSync.errors.connect'))),
  })

  const retryMutation = useMutation({
    mutationFn: () => retryCalendarSync(provider),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
      onSuccess?.(t('settings:calendarSync.success.retry'))
    },
    onError: (error) => onWarning?.(mutationMessage(error, t('settings:calendarSync.errors.retry'))),
  })

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectCalendarSync(provider),
    onSuccess: () => {
      setConfirmDisconnectOpen(false)
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

  const connected = status?.connected === true
  const hasError = status?.status === 'ERROR' || status?.status === 'REVOKED'

  return (
    <section className="settings-card settings-card-spaced" data-testid="calendar-sync-settings">
      <div className="card-section-header">
        <span className="card-section-title">{t('settings:calendarSync.title')}</span>
      </div>
      <div className="calendar-sync-body">
        <div className="calendar-sync-icon" aria-hidden="true">
          <CalendarIcon size={20} />
        </div>
        <div className="calendar-sync-copy">
          <p className="calendar-sync-title">{t(`settings:${providerKey(provider)}`)}</p>
          <p className="calendar-sync-status" data-testid="calendar-sync-status">
            {t(`settings:${statusKey(status)}`)}
            {status?.accountEmail ? ` · ${status.accountEmail}` : ''}
          </p>
          {hasError && (
            <p className="calendar-sync-warning">
              {t('settings:calendarSync.statusWarning', {
                category: status?.lastErrorCategory ?? t('common:unknown'),
              })}
            </p>
          )}
        </div>
        <div className="calendar-sync-actions">
          {!connected && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              data-busy={connectMutation.isPending ? 'true' : undefined}
              data-testid="calendar-sync-connect"
            >
              <CalendarIcon size={14} /> {t('settings:calendarSync.actions.connect')}
            </button>
          )}
          {connected && hasError && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              data-busy={retryMutation.isPending ? 'true' : undefined}
              data-testid="calendar-sync-retry"
            >
              <RefreshCwIcon size={14} /> {t('settings:calendarSync.actions.retry')}
            </button>
          )}
          {connected && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setConfirmDisconnectOpen(true)}
              disabled={disconnectMutation.isPending}
              data-testid="calendar-sync-disconnect"
            >
              <CloseIcon size={14} /> {t('settings:calendarSync.actions.disconnect')}
            </button>
          )}
        </div>
      </div>

      {confirmDisconnectOpen && (
        <Modal
          labelledBy="calendar-sync-disconnect-title"
          onClose={() => setConfirmDisconnectOpen(false)}
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
              onClick={() => setConfirmDisconnectOpen(false)}
              aria-label={t('common:actions.close')}
              disabled={disconnectMutation.isPending}
            >
              <CloseIcon size={18} />
            </button>
          </div>
          <p className="calendar-sync-modal-copy">
            {t('settings:calendarSync.disconnectCopy', {
              provider: t(`settings:${providerKey(provider)}`),
            })}
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setConfirmDisconnectOpen(false)}
              disabled={disconnectMutation.isPending}
            >
              {t('common:actions.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              data-busy={disconnectMutation.isPending ? 'true' : undefined}
            >
              {t('settings:calendarSync.actions.confirmDisconnect')}
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
