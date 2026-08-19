import { useTranslation } from 'react-i18next'
import type { PendingApprovalResponse } from '../../api/generated/types'
import { WorkingDayExplainer } from '../../components/ui/WorkingDayExplainer'
import { CheckIcon } from '../../components/ui/icons'
import { LeaveTypeTag } from '../dashboard/LeaveTypeTag'
import { formatDateRange } from '../dashboard/leaveRequestFormatting'
import { ApprovalProgress } from './ApprovalProgress'

type ApprovalCoverage = {
  isLoading: boolean
  isPartial: boolean
  overlappingStarts: number
}

type ApprovalCardProps = {
  approval: PendingApprovalResponse
  coverage: ApprovalCoverage
  onApprove: () => void
  onDecline: () => void
  onConcern: () => void
  headingRef?: (element: HTMLHeadingElement | null) => void
  isApproving?: boolean
  isDeclining?: boolean
  isStale?: boolean
}

export function ApprovalCard({
  approval,
  coverage,
  onApprove,
  onDecline,
  onConcern,
  headingRef,
  isApproving = false,
  isDeclining = false,
  isStale = false,
}: ApprovalCardProps) {
  const { t, i18n } = useTranslation(['approvals', 'common'])
  const requestId = approval.requestId ?? 0
  const employeeName = approval.employeeFullName?.trim() || t('common:unknown')
  const workforceGroupName =
    approval.workforceGroupName?.trim() || t('approvals:context.groupUnavailable')
  const translatedWeekendDays = approval.weekendDays?.length
    ? approval.weekendDays
        .map((day) => t(`approvals:weekdays.${day}`, { defaultValue: day }))
        .join(', ')
    : null
  const weekendRule = translatedWeekendDays
    ? t('approvals:context.weekendRule', { days: translatedWeekendDays })
    : t('approvals:context.weekendUnavailable')
  const dateRange = formatDateRange(
    approval.dateFrom ?? '',
    approval.dateTo ?? '',
    i18n.language,
  )
  const workingDays = approval.workingDays ?? 0
  const note = approval.note?.trim()
  const busy = isApproving || isDeclining
  const balanceInsufficient =
    approval.balanceCapped === true && approval.balanceSufficient === false
  const isOperationalLevel = (approval.approvalLevel ?? 1) === 1
  const approveDisabled = busy || isStale || (isOperationalLevel && (
    workingDays === 0 || balanceInsufficient
  ))
  // Wrap standalone numbers in a Unicode isolate (FSI…PDI) so digits keep their
  // reading order when interpolated into an RTL sentence (e.g. the "before → after"
  // balance string in Arabic). Not applied to plural `count` values, which must stay
  // numeric for i18next plural selection.
  const bidiIsolate = (value: number): string => `\u2068${value}\u2069`

  let balanceText = t('approvals:balance.unavailable')
  if (approval.balanceCapped === false) {
    balanceText = t('approvals:balance.uncapped')
  } else if (
    approval.balanceCapped === true &&
    approval.balanceRemaining != null &&
    approval.balanceSufficient === false
  ) {
    balanceText = t('approvals:balance.insufficient', {
      remaining: bidiIsolate(approval.balanceRemaining),
      requested: bidiIsolate(workingDays),
    })
  } else if (
    approval.balanceCapped === true &&
    approval.balanceRemaining != null &&
    approval.balanceAfterApproval != null
  ) {
    balanceText = t('approvals:balance.consequence', {
      before: bidiIsolate(approval.balanceRemaining),
      after: bidiIsolate(approval.balanceAfterApproval),
    })
  }

  let coverageText = t('approvals:coverage.loading')
  if (!coverage.isLoading && coverage.isPartial) {
    coverageText = t('approvals:coverage.partial', { group: workforceGroupName })
  } else if (!coverage.isLoading && coverage.overlappingStarts > 0) {
    coverageText = t('approvals:coverage.overlap', {
      count: coverage.overlappingStarts,
      group: workforceGroupName,
    })
  } else if (!coverage.isLoading) {
    coverageText = t('approvals:coverage.noOverlap', { group: workforceGroupName })
  }

  return (
    <article
      className={[
        'approval-card',
        isStale ? 'approval-card--stale' : null,
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid={`approval-card-${requestId}`}
    >
      <div className="approval-card-header">
        <div className="approval-card-identity">
          <p className="approval-card-eyebrow">{t('approvals:queue.requestEyebrow')}</p>
          <h3
            className="approval-card-title"
            data-testid={`approval-card-heading-${requestId}`}
            ref={headingRef}
            tabIndex={-1}
          >
            {employeeName}
          </h3>
          <div className="approval-card-leave-type">
            <LeaveTypeTag
              icon={approval.leaveTypeIcon ?? ''}
              name={approval.leaveTypeName ?? ''}
              color={approval.leaveTypeColor ?? 'inherit'}
              backgroundColor={approval.leaveTypeBackgroundColor ?? 'transparent'}
              borderColor={approval.leaveTypeBorderColor ?? 'transparent'}
            />
          </div>
        </div>

        <div className="approval-card-policy">
          <span className="approval-group-pill">{workforceGroupName}</span>
          <span className="approval-weekend-rule">{weekendRule}</span>
          {approval.nominalApproverFirstName ? (
            <>
              <span
                className="approval-reports-to-pill"
                data-testid={`assigned-approver-pill-${requestId}`}
              >
                {t('approvals:approver.assigned', {
                  name: approval.nominalApproverFirstName,
                })}
              </span>
              <p
                className="approval-on-behalf-notice"
                data-testid={`on-behalf-notice-${requestId}`}
              >
                {t('approvals:approver.actingOnBehalf', {
                  name: approval.nominalApproverFirstName,
                })}
              </p>
            </>
          ) : null}
        </div>
      </div>

      <div className="approval-card-facts">
        <div>
          <span>{t('approvals:context.dates')}</span>
          <strong>
            <bdi>{dateRange}</bdi>
          </strong>
        </div>
        <div>
          <span>{t('approvals:context.balanceAfter')}</span>
          <strong data-testid={`approval-balance-${requestId}`}>{balanceText}</strong>
        </div>
      </div>

      <p className="approval-card-step">
        {t('approvals:progress.currentLevel', { level: approval.approvalLevel ?? 1 })}
      </p>

      <ApprovalProgress evidence={approval.approvalEvidence} compact />

      <WorkingDayExplainer
        compact
        state={workingDays === 0 ? 'zero' : 'valid'}
        stateMessage={
          workingDays === 0
            ? t('approvals:workingDays.zero')
            : t('approvals:workingDays.authoritative')
        }
        resultLabel={t('approvals:table.workingDays', { count: workingDays })}
        policyLabel={t('approvals:workingDays.policy', {
          group: workforceGroupName,
          weekend: weekendRule,
        })}
        detailsLabel={t('approvals:workingDays.details')}
      />

      <section
        className="approval-card-coverage"
        aria-labelledby={`approval-coverage-title-${requestId}`}
        data-testid={`approval-coverage-${requestId}`}
      >
        <p className="approval-card-eyebrow">{t('approvals:coverage.eyebrow')}</p>
        <h4 id={`approval-coverage-title-${requestId}`}>
          {t('approvals:coverage.title')}
        </h4>
        <p>{coverageText}</p>
        <p className="approval-coverage-advisory">
          {t('approvals:coverage.advisory')}
        </p>
      </section>

      {note ? (
        <blockquote className="approval-card-note">
          <span>{t('approvals:context.employeeNote')}</span>
          <p>{note}</p>
        </blockquote>
      ) : null}

      {isStale ? (
        <p className="approval-card-stale" role="status">
          {t('approvals:stale.card', { name: employeeName })}
        </p>
      ) : null}

      {workingDays === 0 ? (
        <span id={`approval-zero-${requestId}`} className="sr-only">
          {t('approvals:workingDays.zero')}
        </span>
      ) : null}

      <div className="approval-actions">
        {isOperationalLevel ? (
          <button
            type="button"
            className="btn btn-danger-outline"
            data-testid={`decline-btn-${requestId}`}
            onClick={onDecline}
            disabled={busy || isStale}
            data-busy={isDeclining ? 'true' : undefined}
            aria-label={t('approvals:aria.declineRequest', { name: employeeName })}
          >
            {t('approvals:actions.decline')}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-outline"
            data-testid={`concern-btn-${requestId}`}
            onClick={onConcern}
            disabled={busy || isStale}
            aria-label={t('approvals:aria.concernRequest', { name: employeeName })}
          >
            {t('approvals:actions.concern')}
          </button>
        )}
        <button
          type="button"
          className="btn btn-success"
          data-testid={`approve-btn-${requestId}`}
          onClick={onApprove}
          disabled={approveDisabled}
          data-busy={isApproving ? 'true' : undefined}
          aria-describedby={
            workingDays === 0
              ? `approval-zero-${requestId}`
              : balanceInsufficient
                ? `approval-balance-${requestId}`
                : undefined
          }
          aria-label={t('approvals:aria.approveRequest', { name: employeeName })}
        >
          {t('approvals:actions.approve')} <CheckIcon size={16} />
        </button>
      </div>
    </article>
  )
}
