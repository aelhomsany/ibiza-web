import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, disconnectSlack, getSlackStatus, installSlack, linkMeToSlack } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon, MessageSquareIcon } from '../../components/ui/icons'
import './chat-notifications.css'

type SlackWorkspaceSettingsProps = {
  onSuccess?: (message: string) => void
  onWarning?: (message: string) => void
}

// Shared with NotificationPreferencesSettings (literal there too — react-refresh forbids exporting it).
const SLACK_STATUS_QUERY_KEY = ['slack-status'] as const

function mutationMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.problem.detail ?? fallback
  }
  return fallback
}

/**
 * Plan PUENTE B6 — Settings → Integrations card for the organization's Slack app (personal DMs).
 * Everyone sees whether the workspace is connected and whether their own Slack account was matched;
 * only HR Admins can install, reconnect, or disconnect. The bot token never reaches the browser and
 * no Slack user ids are shown — the API only reports "linked" / "not linked".
 */
export function SlackWorkspaceSettings({ onSuccess, onWarning }: SlackWorkspaceSettingsProps) {
  const { t, i18n } = useTranslation(['settings', 'common'])
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false)
  const isHrAdmin = user?.role === 'HR_ADMIN'

  const statusQuery = useQuery({
    queryKey: SLACK_STATUS_QUERY_KEY,
    queryFn: getSlackStatus,
  })

  const installMutation = useMutation({
    mutationFn: installSlack,
    // Slack's consent screen must be a top-level navigation; the API redirects back to this page
    // with `?slack=connected|error` once the workspace has been installed (or the install refused).
    onSuccess: (response) => window.location.assign(response.authorizationUrl),
    onError: (error) => onWarning?.(mutationMessage(error, t('settings:slack.errors.install'))),
  })

  const disconnectMutation = useMutation({
    mutationFn: disconnectSlack,
    onSuccess: () => {
      setConfirmingDisconnect(false)
      void queryClient.invalidateQueries({ queryKey: SLACK_STATUS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
      onSuccess?.(t('settings:slack.success.disconnected'))
    },
    onError: (error) => onWarning?.(mutationMessage(error, t('settings:slack.errors.disconnect'))),
  })

  const linkMutation = useMutation({
    mutationFn: linkMeToSlack,
    onSuccess: (link) => {
      void queryClient.invalidateQueries({ queryKey: SLACK_STATUS_QUERY_KEY })
      if (link.linked) {
        onSuccess?.(t('settings:slack.success.linked'))
      } else {
        onWarning?.(t('settings:slack.success.notFound'))
      }
    },
    onError: (error) => onWarning?.(mutationMessage(error, t('settings:slack.errors.link'))),
  })

  const header = (
    <div className="card-section-header">
      <span className="card-section-title">{t('settings:slack.title')}</span>
    </div>
  )

  if (statusQuery.isPending) {
    return (
    <section className="settings-card settings-card-spaced" data-testid="slack-workspace-settings">
      {header}
      <p className="settings-card-loading-inline">{t('settings:slack.loading')}</p>
    </section>
  )
}

  if (statusQuery.isError) {
    return (
      <section className="settings-card settings-card-spaced" data-testid="slack-workspace-settings">
        {header}
        <p className="settings-card-error-inline">{t('settings:slack.errors.load')}</p>
      </section>
    )
  }

  const status = statusQuery.data
  const connected = status.workspaceConnected
  const revoked = !connected && status.status === 'REVOKED'
  const teamName = status.teamName ?? t('common:unknown')
  const busy = installMutation.isPending || disconnectMutation.isPending || linkMutation.isPending

  return (
    <section className="settings-card settings-card-spaced" data-testid="slack-workspace-settings">
      {header}
      <div className="chat-channels-body">
        <div className="chat-channels-intro">
          <p className="chat-channels-copy" data-testid="slack-workspace-copy">
            {revoked
              ? t(isHrAdmin ? 'settings:slack.revoked' : 'settings:slack.revokedMember', {
                  category: status.lastErrorCategory ?? t('common:unknown'),
                })
              : connected
                ? t('settings:slack.connectedIntro')
                : t(isHrAdmin ? 'settings:slack.notConnected' : 'settings:slack.notConnectedMember')}
          </p>
          {isHrAdmin && !connected && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => installMutation.mutate()}
              disabled={busy}
              data-busy={installMutation.isPending ? 'true' : undefined}
              data-testid="slack-workspace-install"
            >
              {t(revoked ? 'settings:slack.actions.reconnect' : 'settings:slack.actions.install')}
            </button>
          )}
        </div>

        {(connected || revoked) && (
          <ul className="chat-channels-list">
            <li className="chat-channel-row" data-testid="slack-workspace-row">
              <div className="chat-channel-icon" aria-hidden="true">
                <MessageSquareIcon size={20} />
              </div>
              <div className="chat-channel-copy">
                <p className="chat-channel-title" dir="auto" data-testid="slack-workspace-team">
                  {t('settings:slack.connectedTo', { team: teamName })}
                </p>
                <p className="chat-channel-meta">
                  <span
                    className={revoked ? 'chat-channel-status--error' : undefined}
                    data-testid="slack-workspace-status"
                  >
                    {t(`settings:slack.status.${revoked ? 'REVOKED' : 'CONNECTED'}`)}
                  </span>
                  {status.installedAt && (
                    <>
                      <span>·</span>
                      <span>
                        {t('settings:slack.installedOn', {
                          when: new Date(status.installedAt).toLocaleDateString(i18n.language),
                        })}
                      </span>
                    </>
                  )}
                </p>
              </div>
              {isHrAdmin && connected && (
                <div className="chat-channel-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setConfirmingDisconnect(true)}
                    disabled={busy}
                    data-testid="slack-workspace-disconnect"
                  >
                    {t('settings:slack.actions.disconnect')}
                  </button>
                </div>
              )}
            </li>

            {connected && (
              <li className="chat-channel-row" data-testid="slack-me-row">
                <div className="chat-channel-icon" aria-hidden="true">
                  <MessageSquareIcon size={20} />
                </div>
                <div className="chat-channel-copy">
                  <p className="chat-channel-title">{t('settings:slack.me.title')}</p>
                  <p
                    className={status.me.linked ? 'chat-channel-meta' : 'chat-channel-warning'}
                    data-testid="slack-me-status"
                  >
                    {t(`settings:slack.me.${status.me.status}`)}
                  </p>
                </div>
                {!status.me.linked && (
                  <div className="chat-channel-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => linkMutation.mutate()}
                      disabled={busy}
                      data-busy={linkMutation.isPending ? 'true' : undefined}
                      data-testid="slack-me-check"
                    >
                      {t(
                        status.me.status === 'NOT_FOUND'
                          ? 'settings:slack.actions.checkAgain'
                          : 'settings:slack.actions.checkNow',
                      )}
                    </button>
                  </div>
                )}
              </li>
            )}
          </ul>
        )}
      </div>

      {confirmingDisconnect && (
        <Modal
          labelledBy="slack-disconnect-title"
          onClose={() => setConfirmingDisconnect(false)}
          closeOnBackdrop={false}
          testId="slack-disconnect-modal"
        >
          <div className="modal-header">
            <h2 className="modal-title" id="slack-disconnect-title">
              {t('settings:slack.disconnectTitle')}
            </h2>
            <button
              type="button"
              className="modal-close"
              onClick={() => setConfirmingDisconnect(false)}
              aria-label={t('common:actions.close')}
              disabled={disconnectMutation.isPending}
            >
              <CloseIcon size={18} />
            </button>
          </div>
          <p className="chat-channel-modal-copy">{t('settings:slack.disconnectCopy', { team: teamName })}</p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setConfirmingDisconnect(false)}
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
              data-testid="slack-workspace-confirm-disconnect"
            >
              {t('settings:slack.actions.confirmDisconnect')}
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}

/**
 * The supporting notes for the Slack app card. Rendered by SettingsPage in the one rail that
 * runs beside the whole Integrations stack, so the cards sit directly beneath each other instead
 * of each card being pushed down by the notes of the card above it.
 */
export function SlackWorkspaceNotes() {
  const { t } = useTranslation(['settings', 'common'])

  return (
    <>
    <section className="support-note" aria-labelledby="slack-sent-title">
      <h3 className="support-note-title" id="slack-sent-title">
        {t('settings:slack.rail.sentTitle')}
      </h3>
      <p className="support-note-body">{t('settings:slack.rail.sentCopy')}</p>
    </section>
    <section className="support-note" aria-labelledby="slack-match-title">
      <h3 className="support-note-title" id="slack-match-title">
        {t('settings:slack.rail.matchTitle')}
      </h3>
      <p className="support-note-body">{t('settings:slack.rail.matchCopy')}</p>
    </section>
    <section className="support-note" aria-labelledby="slack-optout-title">
      <h3 className="support-note-title" id="slack-optout-title">
        {t('settings:slack.rail.optOutTitle')}
      </h3>
      <p className="support-note-body">{t('settings:slack.rail.optOutCopy')}</p>
      <p className="support-note-body">{t('settings:slack.rail.secret')}</p>
    </section>
    </>
  )
}
