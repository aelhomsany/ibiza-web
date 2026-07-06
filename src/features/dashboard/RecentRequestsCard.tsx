import { LeaveStatusBadge } from '../../components/ui/LeaveStatusBadge'
import { InboxIcon } from '../../components/ui/icons'
import type { RecentRequestResponse } from '../../api/generated/types'
import { LeaveTypeTag } from './LeaveTypeTag'
import { formatDateRange } from './leaveRequestFormatting'

type Props = {
  requests: RecentRequestResponse[]
  isLoading?: boolean
  isError?: boolean
}

export function RecentRequestsCard({ requests, isLoading, isError }: Props) {
  if (isLoading) {
    return (
      <div className="card" data-testid="recent-requests-card">
        <div className="card-header">
          <h2 className="card-title">My Recent Requests</h2>
        </div>
        <div className="dashboard-section-loading">Loading recent requests…</div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card" data-testid="recent-requests-card">
        <div className="card-header">
          <h2 className="card-title">My Recent Requests</h2>
        </div>
        <p className="dashboard-error" data-testid="recent-requests-error">
          Unable to load recent requests.
        </p>
      </div>
    )
  }

  return (
    <div className="card" data-testid="recent-requests-card">
      <div className="card-header">
        <h2 className="card-title">My Recent Requests</h2>
      </div>
      {requests.length === 0 ? (
        <div className="dashboard-empty-state">
          <span className="dashboard-empty-icon" aria-hidden="true">
            <InboxIcon size={36} />
          </span>
          <p>No leave requests yet</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Dates</th>
                <th scope="col">Days</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr
                  key={request.id}
                  className={request.status === 'PENDING' ? 'row-pending' : undefined}
                  data-testid={`recent-request-row-${request.id}`}
                >
                  <td>
                    <LeaveTypeTag
                      icon={request.leaveTypeIcon ?? ''}
                      name={request.leaveTypeName ?? ''}
                      color={request.leaveTypeColor ?? 'inherit'}
                      backgroundColor={request.leaveTypeBackgroundColor ?? 'transparent'}
                      borderColor={request.leaveTypeBorderColor ?? 'transparent'}
                    />
                  </td>
                  <td>{formatDateRange(request.dateFrom ?? '', request.dateTo ?? '')}</td>
                  <td>
                    <strong>{request.workingDays}</strong>{' '}
                    <span className="working-caption">working</span>
                  </td>
                  <td>
                    <LeaveStatusBadge status={request.status} />
                    {request.status === 'PENDING' && request.statusHint && (
                      <div className="status-hint">{request.statusHint}</div>
                    )}
                    {request.status === 'DECLINED' && request.declineReason && (
                      <div className="decline-reason">&quot;{request.declineReason}&quot;</div>
                    )}
                    {request.status === 'APPROVED' && request.statusHint && (
                      <div className="status-hint">{request.statusHint}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
