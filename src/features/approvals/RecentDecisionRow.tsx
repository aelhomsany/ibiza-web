import { LeaveTypeTag } from '../dashboard/LeaveTypeTag'
import { formatDateRange } from '../dashboard/leaveRequestFormatting'
import { LeaveStatusBadge } from '../../components/ui/LeaveStatusBadge'
import type { RecentApprovalDecisionResponse } from '../../api/generated/types'
import { AuditHistoryExpander } from './AuditHistoryExpander'

type RecentDecisionRowProps = {
  decision: RecentApprovalDecisionResponse
  showAuditHistory?: boolean
}

function workingDaysLabel(days: number): string {
  return `${days} working day${days === 1 ? '' : 's'}`
}

function formatDecisionDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function RecentDecisionRow({ decision, showAuditHistory = false }: RecentDecisionRowProps) {
  const requestId = decision.requestId ?? 0
  const employeeName = decision.employeeFullName?.trim() || 'Unknown'

  return (
    <tr data-testid={`recent-decision-row-${requestId}`}>
      <td>
        <div className="recent-decision-employee">
          <span>{employeeName}</span>
          {decision.decidedOnBehalf && decision.nominalManagerFirstName ? (
            <span
              className="approval-on-behalf-pill"
              data-testid={`recent-on-behalf-pill-${requestId}`}
            >
              On behalf of {decision.nominalManagerFirstName}
            </span>
          ) : null}
        </div>
      </td>
      <td>
        <LeaveTypeTag
          icon={decision.leaveTypeIcon ?? ''}
          name={decision.leaveTypeName ?? ''}
          color={decision.leaveTypeColor ?? 'inherit'}
          backgroundColor={decision.leaveTypeBackgroundColor ?? 'transparent'}
          borderColor={decision.leaveTypeBorderColor ?? 'transparent'}
        />
      </td>
      <td>{formatDateRange(decision.dateFrom ?? '', decision.dateTo ?? '')}</td>
      <td>{workingDaysLabel(decision.workingDays ?? 0)}</td>
      <td>
        <LeaveStatusBadge status={decision.status ?? 'PENDING'} />
      </td>
      <td>{decision.actorFirstName ?? 'Unknown'}</td>
      <td>{formatDecisionDate(decision.decidedAt ?? '')}</td>
      {showAuditHistory ? (
        <td>
          <AuditHistoryExpander requestId={requestId} />
        </td>
      ) : null}
    </tr>
  )
}
