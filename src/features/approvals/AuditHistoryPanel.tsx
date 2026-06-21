import { useQuery } from '@tanstack/react-query'
import { getLeaveRequestAuditEvents } from '../../api/client'
import type { AuditEventResponse } from '../../api/generated/types'
import './approvals.css'

type AuditHistoryPanelProps = {
  requestId: number
}

function formatActionLabel(action: AuditEventResponse['action']): string {
  switch (action) {
    case 'SUBMITTED':
      return 'Submitted'
    case 'APPROVED':
      return 'Approved'
    case 'DECLINED':
      return 'Declined'
    default:
      return action ?? 'Unknown'
  }
}

function formatTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function AuditHistoryPanel({ requestId }: AuditHistoryPanelProps) {
  const { data: events = [], isPending, isError } = useQuery({
    queryKey: ['leave-requests', requestId, 'audit-events'],
    queryFn: () => getLeaveRequestAuditEvents(requestId),
  })

  if (isPending) {
    return (
      <div className="audit-history-panel" data-testid="audit-history-panel">
        <p className="body-text">Loading audit history…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="audit-history-panel" data-testid="audit-history-panel" role="alert">
        <p className="body-text">Unable to load audit history.</p>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="audit-history-panel" data-testid="audit-history-panel">
        <p className="body-text">No audit events recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="audit-history-panel" data-testid="audit-history-panel">
      <h3 className="audit-history-title">Audit History</h3>
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
                <span className="audit-history-action">{formatActionLabel(event.action)}</span>
                <span className="audit-history-timestamp">
                  {formatTimestamp(event.occurredAt ?? '')}
                </span>
              </div>
              <div className="audit-history-actor">
                <span>{event.actorFirstName ?? 'Unknown'}</span>
                {event.onBehalf && event.nominalManagerFirstName ? (
                  <span
                    className="approval-on-behalf-pill"
                    data-testid={`audit-on-behalf-pill-${eventId}`}
                  >
                    On behalf of {event.nominalManagerFirstName}
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
