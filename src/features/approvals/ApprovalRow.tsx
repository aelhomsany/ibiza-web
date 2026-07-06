import { CheckIcon } from '../../components/ui/icons'
import { LeaveTypeTag } from '../dashboard/LeaveTypeTag'
import { formatDateRange } from '../dashboard/leaveRequestFormatting'
import type { PendingApprovalResponse } from '../../api/generated/types'

type ApprovalRowProps = {
  approval: PendingApprovalResponse
  onApprove: () => void
  onDecline: () => void
  isApproving?: boolean
  isDeclining?: boolean
}

function workingDaysLabel(days: number): string {
  return `${days} working day${days === 1 ? '' : 's'}`
}

export function ApprovalRow({
  approval,
  onApprove,
  onDecline,
  isApproving = false,
  isDeclining = false,
}: ApprovalRowProps) {
  const requestId = approval.requestId ?? 0
  const employeeName = approval.employeeFullName?.trim() || 'Unknown'
  const note = approval.note?.trim()
  const actionsDisabled = isApproving || isDeclining

  return (
    <div className="approval-row" data-testid={`approval-row-${requestId}`}>
      <div className="approval-info">
        <div className="approval-name-row">
          <span className="approval-name">{employeeName}</span>
          {approval.decidedOnBehalf && approval.nominalManagerFirstName ? (
            <span className="approval-on-behalf-pill" data-testid={`on-behalf-pill-${requestId}`}>
              On behalf of {approval.nominalManagerFirstName}
            </span>
          ) : approval.nominalManagerFirstName ? (
            <span className="approval-reports-to-pill" data-testid={`reports-to-pill-${requestId}`}>
              Reports to {approval.nominalManagerFirstName}
            </span>
          ) : null}
        </div>
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
          onClick={onDecline}
          disabled={actionsDisabled}
        >
          Decline
        </button>
        <button
          type="button"
          className="btn btn-sm btn-success"
          data-testid={`approve-btn-${requestId}`}
          onClick={onApprove}
          disabled={actionsDisabled}
        >
          Approve <CheckIcon size={14} />
        </button>
      </div>
    </div>
  )
}
