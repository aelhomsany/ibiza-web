import { LeaveTypeTag } from '../dashboard/LeaveTypeTag'
import { useTranslation } from 'react-i18next'
import { formatDateRange } from '../dashboard/leaveRequestFormatting'
import { LeaveStatusBadge } from '../../components/ui/LeaveStatusBadge'
import type { RecentApprovalDecisionResponse } from '../../api/generated/types'
import { AuditHistoryExpander } from './AuditHistoryExpander'

type RecentDecisionRowProps = {
  decision: RecentApprovalDecisionResponse
  showAuditHistory?: boolean
}

function formatDecisionDate(isoTimestamp: string, locale: string): string {
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp
  }
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function RecentDecisionRow({ decision, showAuditHistory = false }: RecentDecisionRowProps) {
  const { t, i18n } = useTranslation(['approvals', 'common'])
  const requestId = decision.requestId ?? 0
  const employeeName = decision.employeeFullName?.trim() || t('common:unknown')

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
              {t('approvals:manager.onBehalf', { name: decision.nominalManagerFirstName })}
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
      <td>{formatDateRange(decision.dateFrom ?? '', decision.dateTo ?? '', i18n.language)}</td>
      <td>{t('approvals:table.workingDays', { count: decision.workingDays ?? 0 })}</td>
      <td>
        <LeaveStatusBadge status={decision.status ?? 'PENDING'} />
      </td>
      <td>{decision.actorFirstName ?? t('common:unknown')}</td>
      <td>{formatDecisionDate(decision.decidedAt ?? '', i18n.language)}</td>
      {showAuditHistory ? (
        <td>
          <AuditHistoryExpander requestId={requestId} />
        </td>
      ) : null}
    </tr>
  )
}
