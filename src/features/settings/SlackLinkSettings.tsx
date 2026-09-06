import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, getSlackStatus, linkMeToSlack } from '../../api/client'
import { MessageSquareIcon } from '../../components/ui/icons'
import './chat-notifications.css'

type SlackLinkSettingsProps = {
  onSuccess?: (message: string) => void
  onWarning?: (message: string) => void
  /** Rendered beneath the card (its notes band) — and hidden with it while Slack is not connected. */
  children?: ReactNode
}

// Shared with SlackWorkspaceSettings and NotificationPreferencesSettings (literal there too —
// react-refresh forbids exporting it).
const SLACK_STATUS_QUERY_KEY = ['slack-status'] as const

function mutationMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.problem.detail ?? fallback
  }
  return fallback
}

/**
 * Plan PUENTE D-12 — the personal half of the Slack app, on the My settings page for every role:
 * whether this person's own Slack account was matched to their Leaveo email, with a re-check.
 * Renders nothing until an Organization Admin has installed the workspace (Settings → Integrations), so a
 * member of an organization without Slack never sees a Slack card. No Slack user ids are shown —
 * the API only reports "linked" / "not linked".
 */
export function SlackLinkSettings({ onSuccess, onWarning, children }: SlackLinkSettingsProps) {
  const { t } = useTranslation(['settings', 'common'])
  const queryClient = useQueryClient()

  const statusQuery = useQuery({
    queryKey: SLACK_STATUS_QUERY_KEY,
    queryFn: getSlackStatus,
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

  const status = statusQuery.data
  if (!status?.workspaceConnected) {
    return null
  }

  const teamName = status.teamName ?? t('common:unknown')

  return (
    <div className="panel-group">
      <section className="settings-card settings-card-spaced" data-testid="slack-link-settings">
        <div className="card-section-header">
          <span className="card-section-title">{t('settings:slack.me.title')}</span>
        </div>
        <div className="chat-channels-body">
          <div className="chat-channels-intro">
            <p className="chat-channels-copy" data-testid="slack-link-copy">
              {t('settings:slack.me.intro', { team: teamName })}
            </p>
          </div>
          <ul className="chat-channels-list">
            <li className="chat-channel-row" data-testid="slack-me-row">
              <div className="chat-channel-icon" aria-hidden="true">
                <MessageSquareIcon size={20} />
              </div>
              <div className="chat-channel-copy">
                <p className="chat-channel-title" dir="auto">
                  {t('settings:slack.connectedTo', { team: teamName })}
                </p>
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
                    disabled={linkMutation.isPending}
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
          </ul>
        </div>
      </section>
      {children}
    </div>
  )
}

/** The supporting notes for the personal Slack card: what arrives, how matching works, opting out. */
export function SlackLinkNotes() {
  const { t } = useTranslation(['settings', 'common'])

  return (
    <>
      <section className="support-note" aria-labelledby="slack-link-sent-title">
        <h3 className="support-note-title" id="slack-link-sent-title">
          {t('settings:slack.rail.sentTitle')}
        </h3>
        <p className="support-note-body">{t('settings:slack.rail.sentCopy')}</p>
      </section>
      <section className="support-note" aria-labelledby="slack-link-match-title">
        <h3 className="support-note-title" id="slack-link-match-title">
          {t('settings:slack.rail.matchTitle')}
        </h3>
        <p className="support-note-body">{t('settings:slack.rail.matchCopy')}</p>
      </section>
      <section className="support-note" aria-labelledby="slack-link-optout-title">
        <h3 className="support-note-title" id="slack-link-optout-title">
          {t('settings:slack.rail.optOutTitle')}
        </h3>
        <p className="support-note-body">{t('settings:slack.rail.optOutCopy')}</p>
      </section>
    </>
  )
}
