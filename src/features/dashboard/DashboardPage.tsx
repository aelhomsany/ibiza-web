import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type {
  RecentRequestResponse,
  UpcomingAbsenceResponse,
  UserRole,
} from '../../api/generated/types'
import { useAuth } from '../../auth/useAuth'
import { AttentionCallout } from '../../components/ui/AttentionCallout'
import { LoadingState } from '../../components/ui/LoadingState'
import { PlusIcon } from '../../components/ui/icons'
import { useToast } from '../../components/ui/useToast'
import { usePendingApprovalCount } from '../approvals/usePendingApprovalCount'
import { BalanceCard } from './BalanceCard'
import { DashboardValueProof } from './DashboardValueProof'
import { FirstUseCue } from './FirstUseCue'
import { OutTodaySidebar } from './OutTodaySidebar'
import { RecentRequestsCard } from './RecentRequestsCard'
import { RequestLeaveModal } from './RequestLeaveModal'
import {
  formatDateRange,
  localizedRequestStatusHint,
} from './leaveRequestFormatting'
import { useDashboardBalances } from './useDashboardBalances'
import { useDashboardOutToday } from './useDashboardOutToday'
import { useDashboardRecentRequests } from './useDashboardRecentRequests'
import { useDashboardUpcoming } from './useDashboardUpcoming'
import { useOnboarding } from '../onboarding/useOnboarding'
import './dashboard.css'

function firstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName
}

function timeGreetingKey(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'greetings.morning'
  if (hour < 17) return 'greetings.afternoon'
  return 'greetings.evening'
}

type DashboardAttentionProps = {
  role?: UserRole
  pendingCount: number
  isPendingCountLoading: boolean
  isPendingCountError: boolean
  requests: RecentRequestResponse[]
  upcoming: UpcomingAbsenceResponse[]
  isRecentLoading: boolean
  isRecentError: boolean
  language: string
  onRequestLeave: () => void
  onRetryPendingCount: () => void
  onRetryRecent: () => void
}

function DashboardAttention({
  role,
  pendingCount,
  isPendingCountLoading,
  isPendingCountError,
  requests,
  upcoming,
  isRecentLoading,
  isRecentError,
  language,
  onRequestLeave,
  onRetryPendingCount,
  onRetryRecent,
}: DashboardAttentionProps) {
  const { t } = useTranslation(['dashboard', 'common'])
  const reviewsApprovals = role === 'MANAGER' || role === 'HR_ADMIN'

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
        actionLabel={t('dashboard:attention.viewRequests')}
        actionTo="/my-leaves"
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
        actionLabel={t('dashboard:attention.viewRequests')}
        actionTo="/my-leaves"
        tone="status"
      />
    )
  }

  const latestRequest = requests[0]
  if (latestRequest) {
    const declined = latestRequest.status === 'DECLINED'
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
        actionLabel={t('dashboard:attention.viewRequests')}
        actionTo="/my-leaves"
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

export function DashboardPage() {
  const { t, i18n } = useTranslation(['dashboard', 'common', 'onboarding'])
  const { user } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const greetingRef = useRef<HTMLHeadingElement>(null)
  const { showToast } = useToast()
  const balancesQuery = useDashboardBalances()
  const recentQuery = useDashboardRecentRequests()
  const outTodayQuery = useDashboardOutToday()
  const upcomingQuery = useDashboardUpcoming()
  const pendingCountQuery = usePendingApprovalCount()
  // Ambient cue — keeps the 30s cache; only the guided page itself forces a re-read.
  const onboardingQuery = useOnboarding(user?.role === 'HR_ADMIN')
  const pendingCount = pendingCountQuery.data?.count ?? 0
  const guidedOnboarding = onboardingQuery.isSuccess
    && onboardingQuery.data.presentationEnabled !== false

  const showSubmitSuccessToast = useCallback(() => {
    showToast(t('dashboard:request.success'))
  }, [showToast, t])

  return (
    <div className="page page-wide dashboard-layout" data-testid="dashboard-page">
      <header className="page-header">
        <div>
          <h1 className="page-title" ref={greetingRef} tabIndex={-1}>
            {t('greeting', {
              time: t(`dashboard:${timeGreetingKey()}`),
              name: user ? firstName(user.fullName) : t('dashboard:nameFallback'),
            })}
          </h1>
          <p className="page-sub">{t('dashboard:subtitle')}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="request-leave-btn"
          onClick={() => setModalOpen(true)}
        >
          <PlusIcon size={16} /> {t('dashboard:actions.requestLeave')}
        </button>
      </header>

      {user?.role === 'HR_ADMIN' && guidedOnboarding
        && onboardingQuery.data.activationStatus !== 'COMMERCIALLY_ACTIVATED' && (
        <aside className="first-use-cue" data-testid="guided-onboarding-cue">
          <div className="first-use-cue-header">
            <div>
              <p className="first-use-eyebrow">{t('onboarding:dashboardCue.eyebrow')}</p>
              <h2 className="first-use-title">{t('onboarding:dashboardCue.title')}</h2>
              <p className="first-use-summary">{t('onboarding:dashboardCue.body')}</p>
            </div>
          </div>
          <div className="first-use-actions">
            <Link className="btn btn-primary" to="/onboarding">
              {t('onboarding:dashboardCue.action')}
            </Link>
          </div>
        </aside>
      )}

      {user?.role === 'HR_ADMIN'
        && (onboardingQuery.isError
          || (onboardingQuery.isSuccess && onboardingQuery.data.presentationEnabled === false)) && (
        <FirstUseCue
          user={user}
          onStartRequest={() => setModalOpen(true)}
          onDismiss={() => greetingRef.current?.focus()}
        />
      )}

      <div className="dashboard-value-row" data-testid="dashboard-value-row">
        <div className="dashboard-attention-slot">
          <DashboardAttention
            role={user?.role}
            pendingCount={pendingCount}
            isPendingCountLoading={pendingCountQuery.isPending}
            isPendingCountError={pendingCountQuery.isError}
            requests={recentQuery.data ?? []}
            upcoming={upcomingQuery.data ?? []}
            isRecentLoading={recentQuery.isPending}
            isRecentError={recentQuery.isError}
            language={i18n.language}
            onRequestLeave={() => setModalOpen(true)}
            onRetryPendingCount={() => void pendingCountQuery.refetch()}
            onRetryRecent={() => void recentQuery.refetch()}
          />
        </div>
        <DashboardValueProof
          request={recentQuery.data?.[0]}
          workforceGroupName={user?.workforceGroupName}
          isLoading={recentQuery.isPending}
          isError={recentQuery.isError}
          onRetry={() => void recentQuery.refetch()}
        />
      </div>

      <section
        className="dashboard-balances"
        aria-labelledby="dashboard-balances-title"
        data-testid="dashboard-balances-region"
      >
        <div className="dashboard-section-heading">
          <div>
            <p className="dashboard-region-eyebrow">
              {t('dashboard:balances.eyebrow')}
            </p>
            <h2 id="dashboard-balances-title" className="dashboard-section-title">
              {t('dashboard:balances.title')}
            </h2>
          </div>
          <p className="dashboard-section-summary">
            {t('dashboard:balances.summary')}
          </p>
        </div>

        {balancesQuery.isPending && (
          <LoadingState
            label={t('dashboard:balances.loading')}
            variant="skeleton"
            testId="balance-grid-loading"
          >
            <div className="balance-grid">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="dashboard-skeleton-card" />
              ))}
            </div>
          </LoadingState>
        )}

        {balancesQuery.isError && (
          <div className="dashboard-region-error" data-testid="dashboard-balances-error">
            <p role="alert">{t('dashboard:errors.balances')}</p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => void balancesQuery.refetch()}
            >
              {t('common:actions.retry')}
            </button>
          </div>
        )}

        {balancesQuery.isSuccess && balancesQuery.data.length === 0 && (
          <p className="dashboard-region-empty">{t('dashboard:balances.empty')}</p>
        )}

        {balancesQuery.isSuccess && balancesQuery.data.length > 0 && (
          <div className="balance-grid" data-testid="balance-grid">
            {balancesQuery.data.map((balance) => (
              <BalanceCard key={balance.leaveTypeId} balance={balance} />
            ))}
          </div>
        )}
      </section>

      <div className="dash-grid" data-testid="dash-grid">
        <RecentRequestsCard
          requests={recentQuery.data ?? []}
          isLoading={recentQuery.isPending}
          isError={recentQuery.isError}
          onRetry={() => void recentQuery.refetch()}
          onRequestLeave={() => setModalOpen(true)}
        />
        <OutTodaySidebar
          outToday={outTodayQuery.data ?? []}
          upcoming={upcomingQuery.data ?? []}
          isOutTodayLoading={outTodayQuery.isPending}
          isUpcomingLoading={upcomingQuery.isPending}
          isOutTodayError={outTodayQuery.isError}
          isUpcomingError={upcomingQuery.isError}
          onRetryOutToday={() => void outTodayQuery.refetch()}
          onRetryUpcoming={() => void upcomingQuery.refetch()}
        />
      </div>

      <RequestLeaveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={showSubmitSuccessToast}
      />
    </div>
  )
}
