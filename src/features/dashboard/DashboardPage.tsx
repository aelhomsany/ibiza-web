import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { Toast } from '../../components/ui/Toast'
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

function timeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPage() {
  const { user } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const { toast, showToast, dismissToast } = useToast()
  const balancesQuery = useDashboardBalances()
  const recentQuery = useDashboardRecentRequests()
  const outTodayQuery = useDashboardOutToday()
  const upcomingQuery = useDashboardUpcoming()
  const pendingCountQuery = usePendingApprovalCount()
  const pendingCount = pendingCountQuery.data?.count ?? 0
  const showPendingAlert =
    (user?.role === 'MANAGER' || user?.role === 'HR_ADMIN') && pendingCount > 0

  const showSubmitSuccessToast = useCallback(() => {
    showToast('Leave request submitted — waiting for approval')
  }, [showToast])

  return (
    <div className="page page-wide" data-testid="dashboard-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            {timeGreeting()}, {user ? firstName(user.fullName) : 'there'}!
          </h1>
          <p className="page-sub">Here&apos;s your leave overview</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="request-leave-btn"
          onClick={() => setModalOpen(true)}
        >
          <PlusIcon size={16} /> Request Leave
        </button>
      </header>

      {showPendingAlert ? (
        <div className="dashboard-pending-alert" data-testid="dashboard-pending-alert" role="status">
          <span>{pendingCount} Pending Approvals</span>
          <Link to="/approvals" className="dashboard-pending-alert-link">
            Review Now
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
          Unable to load your leave balances.
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

      <Toast toast={toast} onDismiss={dismissToast} testId="submit-success-toast" />
    </div>
  )
}
