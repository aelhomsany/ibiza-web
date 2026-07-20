import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getLeaveRequestAuditEvents } from '../../api/client'
import type { AuditEventResponse } from '../../api/generated/types'
import './approvals.css'

type AuditHistoryPanelProps = {
  requestId: number
}

function actionKey(action: AuditEventResponse['action']): string | null {
  switch (action) {
    case 'SUBMITTED':
      return 'audit.actions.submitted'
    case 'APPROVED':
      return 'audit.actions.approved'
    case 'DECLINED':
      return 'audit.actions.declined'
    default:
      return null
  }
}

function formatTimestamp(isoTimestamp: string, locale: string): string {
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp
  }
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function AuditHistoryPanel({ requestId }: AuditHistoryPanelProps) {
  const { t, i18n } = useTranslation(['approvals', 'common'])
  const { data: events = [], isPending, isError } = useQuery({
    queryKey: ['leave-requests', requestId, 'audit-events'],
    queryFn: () => getLeaveRequestAuditEvents(requestId),
  })

  if (isPending) {
    return (
      <div className="audit-history-panel" data-testid="audit-history-panel">
        <p className="body-text">{t('approvals:audit.loading')}</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="audit-history-panel" data-testid="audit-history-panel" role="alert">
        <p className="body-text">{t('approvals:audit.loadError')}</p>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="audit-history-panel" data-testid="audit-history-panel">
        <p className="body-text">{t('approvals:audit.empty')}</p>
      </div>
    )
  }

  return (
    <div className="audit-history-panel" data-testid="audit-history-panel">
      <h3 className="audit-history-title">{t('approvals:audit.title')}</h3>
      <ol className="audit-history-timeline">
        {events.map((event) => {
          const eventId = event.id ?? 0
          return (
            <li
              key={eventId}
              className="audit-history-event"
              data-testid={`audit-event-${eventId}`}
            >
              <div className="audit-history-event-header">
                <span className="audit-history-action">
                  {actionKey(event.action) ? t(`approvals:${actionKey(event.action)}`) : event.action ?? t('common:unknown')}
                </span>
                <span className="audit-history-timestamp">
                  {formatTimestamp(event.occurredAt ?? '', i18n.language)}
                </span>
              </div>
              <div className="audit-history-actor">
                <span>{event.actorFirstName ?? t('common:unknown')}</span>
                {event.onBehalf && event.nominalManagerFirstName ? (
                  <span
                    className="approval-on-behalf-pill"
                    data-testid={`audit-on-behalf-pill-${eventId}`}
                  >
                    {t('approvals:audit.onBehalf', { name: event.nominalManagerFirstName })}
                  </span>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
