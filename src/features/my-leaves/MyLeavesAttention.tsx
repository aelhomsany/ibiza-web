import { useTranslation } from 'react-i18next'
import type {
  RecentRequestResponse,
  UpcomingAbsenceResponse,
} from '../../api/generated/types'
import { AttentionCallout } from '../../components/ui/AttentionCallout'
import {
  formatDateRange,
  localizedRequestStatusHint,
} from '../dashboard/leaveRequestFormatting'

type MyLeavesAttentionProps = {
  canReviewApprovals: boolean
  pendingCount: number
  isPendingCountLoading: boolean
  isPendingCountError: boolean
  requests: RecentRequestResponse[]
  upcoming: UpcomingAbsenceResponse[]
  isRecentLoading: boolean
  isRecentError: boolean
  language: string
  onRequestLeave: () => void
  onViewRequest: (requestId: number) => void
  onRetryPendingCount: () => void
  onRetryRecent: () => void
}

/**
 * The Dashboard's "Your next step" priority chain, re-homed onto the merged
 * My Leaves page (Dashboard + My Leaves merge, 2026-09-01). The chain is
 * unchanged — approvals first, then the viewer's own most relevant request —
 * but request-level actions expand the request in the history below via
 * `onViewRequest` instead of navigating to a page we are already on.
 */
export function MyLeavesAttention({
  canReviewApprovals,
  pendingCount,
  isPendingCountLoading,
  isPendingCountError,
  requests,
  upcoming,
  isRecentLoading,
  isRecentError,
  language,
  onRequestLeave,
  onViewRequest,
  onRetryPendingCount,
  onRetryRecent,
}: MyLeavesAttentionProps) {
  const { t } = useTranslation(['dashboard', 'leaves', 'common'])
  const reviewsApprovals = canReviewApprovals

  if (reviewsApprovals && isPendingCountLoading) {
    return (
      <AttentionCallout
        eyebrow={t('dashboard:attention.eyebrow')}
        title={t('dashboard:attention.loadingApprovalsTitle')}
        description={t('dashboard:attention.loadingApprovalsDescription')}
        tone="status"
        isLoading
      />
    )
  }

  if (reviewsApprovals && isPendingCountError) {
    return (
      <AttentionCallout
        eyebrow={t('dashboard:attention.eyebrow')}
        title={t('dashboard:attention.errorTitle')}
        description={t('dashboard:attention.errorDescription')}
        actionLabel={t('common:actions.retry')}
        onAction={onRetryPendingCount}
        tone="error"
      />
    )
  }

  if (reviewsApprovals && pendingCount > 0) {
    return (
      <AttentionCallout
        eyebrow={t('dashboard:attention.eyebrow')}
        title={t('dashboard:attention.pendingApprovals', { count: pendingCount })}
        description={t('dashboard:attention.pendingApprovalsDescription')}
        actionLabel={t('dashboard:actions.reviewNow')}
        actionTo="/approvals"
        count={pendingCount}
        tone="priority"
      />
    )
  }

  if (isRecentLoading) {
    return (
      <AttentionCallout
        eyebrow={t('dashboard:attention.eyebrow')}
        title={t('dashboard:attention.loadingRequestsTitle')}
        description={t('dashboard:attention.loadingRequestsDescription')}
        tone="status"
        isLoading
      />
    )
  }

  if (isRecentError) {
    return (
      <AttentionCallout
        eyebrow={t('dashboard:attention.eyebrow')}
        title={t('dashboard:attention.errorTitle')}
        description={t('dashboard:attention.errorDescription')}
        actionLabel={t('common:actions.retry')}
        onAction={onRetryRecent}
        tone="error"
      />
    )
  }

  const pendingRequest = requests.find((request) => request.status === 'PENDING')
  if (pendingRequest) {
    const pendingId = pendingRequest.id
    return (
      <AttentionCallout
        eyebrow={t('dashboard:attention.eyebrow')}
        title={t('dashboard:attention.pendingRequestTitle')}
        description={t('dashboard:attention.requestDescriptionWithStatus', {
          type: pendingRequest.leaveTypeName,
          dates: formatDateRange(
            pendingRequest.dateFrom ?? '',
            pendingRequest.dateTo ?? '',
            language,
          ),
          status: localizedRequestStatusHint(pendingRequest, t),
        })}
        actionLabel={t('leaves:attention.viewRequest')}
        onAction={pendingId == null ? undefined : () => onViewRequest(pendingId)}
        tone="status"
      />
    )
  }

  const upcomingRequest = requests.find(
    (request) =>
      request.status === 'APPROVED' &&
      upcoming.some((absence) => absence.id === request.id),
  )
  if (upcomingRequest) {
    const upcomingId = upcomingRequest.id
    return (
      <AttentionCallout
        eyebrow={t('dashboard:attention.eyebrow')}
        title={t('dashboard:attention.upcomingTitle', {
          date: formatDateRange(
            upcomingRequest.dateFrom ?? '',
            upcomingRequest.dateFrom ?? '',
            language,
          ),
        })}
        description={t('dashboard:attention.upcomingDescription', {
          type: upcomingRequest.leaveTypeName,
          days: t('dashboard:valueProof.workingDays', {
            count: upcomingRequest.workingDays,
          }),
        })}
        actionLabel={t('leaves:attention.viewRequest')}
        onAction={upcomingId == null ? undefined : () => onViewRequest(upcomingId)}
        tone="status"
      />
    )
  }

  const latestRequest = requests[0]
  if (latestRequest) {
    const declined = latestRequest.status === 'DECLINED'
    const latestId = latestRequest.id
    return (
      <AttentionCallout
        eyebrow={t('dashboard:attention.eyebrow')}
        title={
          declined
            ? t('dashboard:attention.declinedTitle')
            : t('dashboard:attention.approvedTitle')
        }
        description={
          latestRequest.declineReason ??
          localizedRequestStatusHint(latestRequest, t) ??
          t('dashboard:attention.requestDescription', {
            type: latestRequest.leaveTypeName,
            dates: formatDateRange(
              latestRequest.dateFrom ?? '',
              latestRequest.dateTo ?? '',
              language,
            ),
          })
        }
        actionLabel={t('leaves:attention.viewRequest')}
        onAction={latestId == null ? undefined : () => onViewRequest(latestId)}
        tone={declined ? 'priority' : 'status'}
      />
    )
  }

  return (
    <AttentionCallout
      eyebrow={t('dashboard:attention.eyebrow')}
      title={t('dashboard:attention.emptyTitle')}
      description={t('dashboard:attention.emptyDescription')}
      actionLabel={t('dashboard:actions.requestLeave')}
      onAction={onRequestLeave}
      tone="calm"
    />
  )
}
