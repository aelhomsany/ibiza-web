import { LeaveTypeTag } from '../dashboard/LeaveTypeTag'
import { formatDateRange } from '../dashboard/leaveRequestFormatting'
import type { PendingApprovalResponse } from '../../api/generated/types'

type ApprovalRowProps = {
  approval: PendingApprovalResponse
}

function workingDaysLabel(days: number): string {
  return `${days} working day${days === 1 ? '' : 's'}`
}

export function ApprovalRow({ approval }: ApprovalRowProps) {
  const requestId = approval.requestId ?? 0
  const employeeName = approval.employeeFullName?.trim() || 'Unknown'
  const note = approval.note?.trim()

  return (
    <div className="approval-row" data-testid={`approval-row-${requestId}`}>
      <div className="approval-info">
        <div className="approval-name">{employeeName}</div>
        <div className="approval-details">
          <LeaveTypeTag
            icon={approval.leaveTypeIcon ?? ''}
            name={approval.leaveTypeName ?? ''}
            color={approval.leaveTypeColor ?? 'inherit'}
            backgroundColor={approval.leaveTypeBackgroundColor ?? 'transparent'}
            borderColor={approval.leaveTypeBorderColor ?? 'transparent'}
          />
          <span className="approval-meta">
            {' · '}
            {formatDateRange(approval.dateFrom ?? '', approval.dateTo ?? '')}
            {' · '}
            <strong>{workingDaysLabel(approval.workingDays ?? 0)}</strong>
            {approval.workforceGroupName ? (
              <span className="approval-group-pill">{approval.workforceGroupName}</span>
            ) : null}
          </span>
        </div>
        {note ? (
          <div className="approval-note">&quot;{note}&quot;</div>
        ) : null}
      </div>
      <div className="approval-actions">
        <button
          type="button"
          className="btn btn-sm btn-danger-outline"
          data-testid={`decline-btn-${requestId}`}
          title="Decline actions arrive in Story 3.7"
          disabled
        >
          Decline
        </button>
        <button
          type="button"
          className="btn btn-sm btn-success"
          data-testid={`approve-btn-${requestId}`}
          title="Approve actions arrive in Story 3.7"
          disabled
        >
          Approve ✓
        </button>
      </div>
    </div>
  )
}
