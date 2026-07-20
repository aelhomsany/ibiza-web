import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { PlusIcon } from '../../components/ui/icons'
import { useToast } from '../../components/ui/useToast'
import { usePendingApprovalCount } from '../approvals/usePendingApprovalCount'
import { BalanceCard } from './BalanceCard'
import { OutTodaySidebar } from './OutTodaySidebar'
import { RecentRequestsCard } from './RecentRequestsCard'
import { RequestLeaveModal } from './RequestLeaveModal'
import { useDashboardBalances } from './useDashboardBalances'
import { useDashboardOutToday } from './useDashboardOutToday'
import { useDashboardRecentRequests } from './useDashboardRecentRequests'
import { useDashboardUpcoming } from './useDashboardUpcoming'
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

export function DashboardPage() {
  const { t } = useTranslation('dashboard')
  const { user } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const { showToast } = useToast()
  const balancesQuery = useDashboardBalances()
  const recentQuery = useDashboardRecentRequests()
  const outTodayQuery = useDashboardOutToday()
  const upcomingQuery = useDashboardUpcoming()
  const pendingCountQuery = usePendingApprovalCount()
  const pendingCount = pendingCountQuery.data?.count ?? 0
  const showPendingAlert =
    (user?.role === 'MANAGER' || user?.role === 'HR_ADMIN') && pendingCount > 0

  const showSubmitSuccessToast = useCallback(() => {
    showToast(t('request.success'))
  }, [showToast, t])

  return (
    <div className="page page-wide dashboard-layout" data-testid="dashboard-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            {t('greeting', {
              time: t(timeGreetingKey()),
              name: user ? firstName(user.fullName) : t('nameFallback'),
            })}
          </h1>
          <p className="page-sub">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="request-leave-btn"
          onClick={() => setModalOpen(true)}
        >
          <PlusIcon size={16} /> {t('actions.requestLeave')}
        </button>
      </header>

      {showPendingAlert ? (
        <div className="dashboard-pending-alert" data-testid="dashboard-pending-alert" role="status">
          <span>{t('pendingApprovals', { count: pendingCount })}</span>
          <Link to="/approvals" className="dashboard-pending-alert-link">
            {t('actions.reviewNow')}
          </Link>
        </div>
      ) : null}

      {balancesQuery.isPending && (
        <div className="balance-grid" data-testid="balance-grid-loading">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="dashboard-skeleton-card" />
          ))}
        </div>
      )}

      {balancesQuery.isError && (
        <p className="dashboard-error" data-testid="dashboard-balances-error">
          {t('errors.balances')}
        </p>
      )}

      {balancesQuery.isSuccess && (
        <div className="balance-grid" data-testid="balance-grid">
          {balancesQuery.data.map((balance) => (
            <BalanceCard key={balance.leaveTypeId} balance={balance} />
          ))}
        </div>
      )}

      <div className="dash-grid" data-testid="dash-grid">
        <RecentRequestsCard
          requests={recentQuery.data ?? []}
          isLoading={recentQuery.isPending}
          isError={recentQuery.isError}
        />
        <OutTodaySidebar
          outToday={outTodayQuery.data ?? []}
          upcoming={upcomingQuery.data ?? []}
          isOutTodayLoading={outTodayQuery.isPending}
          isUpcomingLoading={upcomingQuery.isPending}
          isOutTodayError={outTodayQuery.isError}
          isUpcomingError={upcomingQuery.isError}
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
