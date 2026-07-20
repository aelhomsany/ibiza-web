import { CheckIcon } from '../../components/ui/icons'
import { useTranslation } from 'react-i18next'
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

export function ApprovalRow({
  approval,
  onApprove,
  onDecline,
  isApproving = false,
  isDeclining = false,
}: ApprovalRowProps) {
  const { t, i18n } = useTranslation(['approvals', 'common'])
  const requestId = approval.requestId ?? 0
  const employeeName = approval.employeeFullName?.trim() || t('common:unknown')
  const note = approval.note?.trim()
  const actionsDisabled = isApproving || isDeclining

  return (
    <div className="approval-row" data-testid={`approval-row-${requestId}`}>
      <div className="approval-info">
        <div className="approval-name-row">
          <span className="approval-name">{employeeName}</span>
          {approval.decidedOnBehalf && approval.nominalManagerFirstName ? (
            <span className="approval-on-behalf-pill" data-testid={`on-behalf-pill-${requestId}`}>
              {t('approvals:manager.onBehalf', { name: approval.nominalManagerFirstName })}
            </span>
          ) : approval.nominalManagerFirstName ? (
            <span className="approval-reports-to-pill" data-testid={`reports-to-pill-${requestId}`}>
              {t('approvals:manager.reportsTo', { name: approval.nominalManagerFirstName })}
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
            {formatDateRange(approval.dateFrom ?? '', approval.dateTo ?? '', i18n.language)}
            {' · '}
            <strong>{t('approvals:table.workingDays', { count: approval.workingDays ?? 0 })}</strong>
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
          data-busy={isDeclining ? 'true' : undefined}
          aria-label={t('approvals:aria.declineRequest', { name: employeeName })}
        >
          {t('approvals:actions.decline')}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-success"
          data-testid={`approve-btn-${requestId}`}
          onClick={onApprove}
          disabled={actionsDisabled}
          data-busy={isApproving ? 'true' : undefined}
          aria-label={t('approvals:aria.approveRequest', { name: employeeName })}
        >
          {t('approvals:actions.approve')} <CheckIcon size={14} />
        </button>
      </div>
    </div>
  )
}
