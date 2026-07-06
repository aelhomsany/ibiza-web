import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { LeaveStatusBadge } from '../../components/ui/LeaveStatusBadge'
import { AuditHistoryExpander } from '../approvals/AuditHistoryExpander'
import { LeaveTypeTag } from '../dashboard/LeaveTypeTag'
import { formatDateRange } from '../dashboard/leaveRequestFormatting'
import { useLeaveRequestContext } from './useLeaveRequestContext'
import '../my-leaves/my-leaves.css'
import './request-context.css'

function parseRequestId(id: string | undefined): number | undefined {
  if (!id) {
    return undefined
  }
  const parsed = Number(id)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

export function RequestContextPage() {
  const { id } = useParams()
  const requestId = parseRequestId(id)
  const { user } = useAuth()
  const isHrAdmin = user?.role === 'HR_ADMIN'
  const query = useLeaveRequestContext(requestId)

  if (requestId == null) {
    return (
      <div className="page page-wide" data-testid="request-context-page">
        <section className="card request-context-card">
          <h1 className="card-title">Request Not Found</h1>
          <p className="dashboard-error">This request link is invalid.</p>
          <Link className="btn btn-primary request-context-back-link" to="/calendar">
            Back To Calendar
          </Link>
        </section>
      </div>
    )
  }

  if (query.isPending) {
    return (
      <div className="page page-wide" data-testid="request-context-page">
        <div className="dashboard-section-loading" data-testid="request-context-loading">
          Loading request context...
        </div>
      </div>
    )
  }

  if (query.isError) {
    const detail =
      query.error instanceof ApiError
        ? (query.error.problem.detail ?? 'Request context is unavailable.')
        : 'Request context is unavailable.'

    return (
      <div className="page page-wide" data-testid="request-context-page">
        <section className="card request-context-card">
          <h1 className="card-title">Request Not Found</h1>
          <p className="dashboard-error" data-testid="request-context-error">
            {detail}
          </p>
          <div className="request-context-actions">
            <Link className="btn btn-primary request-context-back-link" to="/calendar">
              Back To Calendar
            </Link>
            <Link className="btn request-context-back-link" to="/my-leaves">
              My Leaves
            </Link>
          </div>
        </section>
      </div>
    )
  }

  const request = query.data

  return (
    <div className="page page-wide" data-testid="request-context-page">
      <header className="page-header request-context-header">
        <div>
          <p className="page-kicker">Leave Request</p>
          <h1 className="page-title">{request.leaveTypeName}</h1>
          <p className="page-sub">{request.requesterFullName}</p>
        </div>
        <Link className="btn request-context-back-link" to="/calendar">
          Back To Calendar
        </Link>
      </header>

      <section className="card request-context-card" aria-labelledby="request-context-title">
        <div className="card-header">
          <h2 id="request-context-title" className="card-title">
            Request Details
          </h2>
        </div>

        <dl className="request-context-summary">
          <div>
            <dt>Leave type</dt>
            <dd>
              <LeaveTypeTag
                icon={request.leaveTypeIcon ?? ''}
                name={request.leaveTypeName ?? ''}
                color={request.leaveTypeColor ?? 'inherit'}
                backgroundColor={request.leaveTypeBackgroundColor ?? 'transparent'}
                borderColor={request.leaveTypeBorderColor ?? 'transparent'}
              />
            </dd>
          </div>
          <div>
            <dt>Requester</dt>
            <dd>{request.requesterFullName}</dd>
          </div>
          <div>
            <dt>Dates</dt>
            <dd>{formatDateRange(request.dateFrom ?? '', request.dateTo ?? '')}</dd>
          </div>
          <div>
            <dt>Working days</dt>
            <dd>{request.workingDays} working days</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <LeaveStatusBadge status={request.status} />
              {request.statusHint ? <span className="status-hint">{request.statusHint}</span> : null}
              {request.status === 'DECLINED' && request.declineReason ? (
                <span className="decline-reason">&quot;{request.declineReason}&quot;</span>
              ) : null}
            </dd>
          </div>
          {isHrAdmin && request.id != null ? (
            <div>
              <dt>Audit</dt>
              <dd>
                <AuditHistoryExpander requestId={request.id} />
              </dd>
            </div>
          ) : null}
        </dl>
      </section>
    </div>
  )
}
