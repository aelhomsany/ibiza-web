import { useTranslation } from 'react-i18next'
import type { RecentRequestResponse } from '../../api/generated/types'
import { WorkingDayExplainer } from '../../components/ui/WorkingDayExplainer'
import {
  formatDateRange,
  localizedRequestStatusHint,
} from './leaveRequestFormatting'

type DashboardValueProofProps = {
  request?: RecentRequestResponse
  workforceGroupName?: string | null
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
}

export function DashboardValueProof({
  request,
  workforceGroupName,
  isLoading = false,
  isError = false,
  onRetry,
}: DashboardValueProofProps) {
  const { t, i18n } = useTranslation(['dashboard', 'common'])
  const policyLabel = workforceGroupName
    ? t('dashboard:valueProof.policy', { group: workforceGroupName })
    : t('dashboard:valueProof.policyFallback')

  if (isLoading) {
    return (
      <section className="dashboard-value-proof" data-testid="dashboard-value-proof">
        <p className="dashboard-region-eyebrow">{t('dashboard:valueProof.eyebrow')}</p>
        <h2 className="dashboard-region-title">{t('dashboard:valueProof.title')}</h2>
        <WorkingDayExplainer
          compact
          state="loading"
          stateMessage={t('dashboard:valueProof.loading')}
        />
      </section>
    )
  }

  if (isError) {
    return (
      <section className="dashboard-value-proof" data-testid="dashboard-value-proof">
        <p className="dashboard-region-eyebrow">{t('dashboard:valueProof.eyebrow')}</p>
        <h2 className="dashboard-region-title">{t('dashboard:valueProof.title')}</h2>
        <WorkingDayExplainer
          compact
          state="error"
          stateMessage={t('dashboard:valueProof.error')}
          retryLabel={onRetry ? t('common:actions.retry') : undefined}
          onRetry={onRetry}
        />
      </section>
    )
  }

  const localizedHint = request
    ? request.declineReason ?? localizedRequestStatusHint(request, t)
    : null
  const requestContext = request
    ? localizedHint
      ? t('dashboard:valueProof.requestContextWithHint', {
          type: request.leaveTypeName,
          dates: formatDateRange(
            request.dateFrom ?? '',
            request.dateTo ?? '',
            i18n.language,
          ),
          hint: localizedHint,
        })
      : t('dashboard:valueProof.requestContext', {
          type: request.leaveTypeName,
          dates: formatDateRange(
            request.dateFrom ?? '',
            request.dateTo ?? '',
            i18n.language,
          ),
        })
    : t('dashboard:valueProof.educationSummary')

  return (
    <section className="dashboard-value-proof" data-testid="dashboard-value-proof">
      <p className="dashboard-region-eyebrow">
        {request
          ? t('dashboard:valueProof.latestEyebrow')
          : t('dashboard:valueProof.educationEyebrow')}
      </p>
      <h2 className="dashboard-region-title">{t('dashboard:valueProof.title')}</h2>
      <div className="dashboard-value-facts">
        <p>{requestContext}</p>
        <p className="dashboard-value-policy">{policyLabel}</p>
      </div>
      <WorkingDayExplainer
        compact
        state="valid"
        stateMessage=""
        resultLabel={
          request
            ? t('dashboard:valueProof.workingDays', { count: request.workingDays })
            : t('dashboard:valueProof.educationResult')
        }
        detailsLabel={t('dashboard:valueProof.details')}
      />
    </section>
  )
}
