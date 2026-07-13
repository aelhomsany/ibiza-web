import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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

function providerLabel(provider: CalendarSyncStatusResponse['provider']) {
  return provider === 'GOOGLE' ? 'Google Calendar' : 'Microsoft Outlook'
}

function statusText(status?: CalendarSyncStatusResponse) {
  if (!status || !status.connected) {
    return 'Not connected'
  }
  if (status.status === 'ERROR') {
    return 'Connected with sync error'
  }
  if (status.status === 'REVOKED') {
    return 'Connection needs attention'
  }
  return 'Connected'
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
    onError: (error) => onWarning?.(mutationMessage(error, 'Unable to start calendar connection')),
  })

  const retryMutation = useMutation({
    mutationFn: () => retryCalendarSync(provider),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
      onSuccess?.('Calendar sync retry queued')
    },
    onError: (error) => onWarning?.(mutationMessage(error, 'Unable to retry calendar sync')),
  })

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectCalendarSync(provider),
    onSuccess: () => {
      setConfirmDisconnectOpen(false)
      void queryClient.invalidateQueries({ queryKey })
      onSuccess?.('Calendar sync disconnected')
    },
    onError: (error) => onWarning?.(mutationMessage(error, 'Unable to disconnect calendar sync')),
  })

  if (statusQuery.isPending) {
    return (
      <section className="settings-card settings-card-spaced" data-testid="calendar-sync-settings">
        <div className="card-section-header">
          <span className="card-section-title">Calendar Sync</span>
        </div>
        <p className="settings-card-loading-inline">Loading calendar sync…</p>
      </section>
    )
  }

  if (statusQuery.isError) {
    return (
      <section className="settings-card settings-card-spaced" data-testid="calendar-sync-settings">
        <div className="card-section-header">
          <span className="card-section-title">Calendar Sync</span>
        </div>
        <p className="settings-card-error-inline">Unable to load calendar sync status.</p>
      </section>
    )
  }

  const connected = status?.connected === true
  const hasError = status?.status === 'ERROR' || status?.status === 'REVOKED'

  return (
    <section className="settings-card settings-card-spaced" data-testid="calendar-sync-settings">
      <div className="card-section-header">
        <span className="card-section-title">Calendar Sync</span>
      </div>
      <div className="calendar-sync-body">
        <div className="calendar-sync-icon" aria-hidden="true">
          <CalendarIcon size={20} />
        </div>
        <div className="calendar-sync-copy">
          <p className="calendar-sync-title">{providerLabel(provider)}</p>
          <p className="calendar-sync-status" data-testid="calendar-sync-status">
            {statusText(status)}
            {status?.accountEmail ? ` · ${status.accountEmail}` : ''}
          </p>
          {hasError && (
            <p className="calendar-sync-warning">
              Sync needs attention. Error category: {status?.lastErrorCategory ?? 'Unknown'}
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
              <CalendarIcon size={14} /> Connect
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
              <RefreshCwIcon size={14} /> Retry
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
              <CloseIcon size={14} /> Disconnect
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
              Disconnect Calendar Sync
            </h2>
            <button
              type="button"
              className="modal-close"
              onClick={() => setConfirmDisconnectOpen(false)}
              aria-label="Close"
              disabled={disconnectMutation.isPending}
            >
              <CloseIcon size={18} />
            </button>
          </div>
          <p className="calendar-sync-modal-copy">
            Future approved leave will stop syncing to {providerLabel(provider)}. Existing
            external calendar events are left unchanged.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setConfirmDisconnectOpen(false)}
              disabled={disconnectMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              data-busy={disconnectMutation.isPending ? 'true' : undefined}
            >
              Confirm Disconnect
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
