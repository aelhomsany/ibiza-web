import { useCallback, useState } from 'react'
import type { RecentRequestResponse } from '../../api/generated/types'
import { useAuth } from '../../auth/useAuth'
import { LeaveStatusBadge } from '../../components/ui/LeaveStatusBadge'
import { Toast } from '../../components/ui/Toast'
import { PlusIcon } from '../../components/ui/icons'
import { useToast } from '../../components/ui/useToast'
import { AuditHistoryExpander } from '../approvals/AuditHistoryExpander'
import { BalanceCard } from '../dashboard/BalanceCard'
import { LeaveTypeTag } from '../dashboard/LeaveTypeTag'
import { RequestLeaveModal } from '../dashboard/RequestLeaveModal'
import { formatDateRange } from '../dashboard/leaveRequestFormatting'
import { useDashboardBalances } from '../dashboard/useDashboardBalances'
import { useMyLeaveRequests } from './useMyLeaveRequests'
import '../dashboard/dashboard.css'
import './my-leaves.css'

function HistoryStatusCell({ request }: { request: RecentRequestResponse }) {
  return (
    <>
      <LeaveStatusBadge status={request.status} />
      {request.statusHint && <div className="status-hint">{request.statusHint}</div>}
      {request.status === 'DECLINED' && request.declineReason && (
        <div className="decline-reason">&quot;{request.declineReason}&quot;</div>
      )}
    </>
  )
}

function HistoryTable({
  requests,
  showAuditHistory,
}: {
  requests: RecentRequestResponse[]
  showAuditHistory: boolean
}) {
  if (requests.length === 0) {
    return (
      <div className="dashboard-empty-state" data-testid="my-leaves-empty-state">
        <p>No leave requests yet. Start a request when you need time away.</p>
      </div>
    )
  }

  return (
    <div className="table-wrap" data-testid="my-leaves-history-table">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th scope="col">Type</th>
            <th scope="col">Dates</th>
            <th scope="col">Days</th>
            <th scope="col">Status</th>
            {showAuditHistory ? <th scope="col">Audit</th> : null}
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr
              key={request.id}
              className={request.status === 'PENDING' ? 'row-pending' : undefined}
              data-testid={`my-leaves-request-row-${request.id}`}
            >
              <td>
                <LeaveTypeTag
                  icon={request.leaveTypeIcon ?? ''}
                  name={request.leaveTypeName ?? ''}
                  color={request.leaveTypeColor ?? 'inherit'}
                  backgroundColor={request.leaveTypeBackgroundColor ?? 'transparent'}
                  borderColor={request.leaveTypeBorderColor ?? 'transparent'}
                />
              </td>
              <td>{formatDateRange(request.dateFrom ?? '', request.dateTo ?? '')}</td>
              <td>
                <strong>{request.workingDays}</strong>{' '}
                <span className="working-caption">working</span>
              </td>
              <td>
                <HistoryStatusCell request={request} />
              </td>
              {showAuditHistory ? (
                <td>
                  {request.id != null ? <AuditHistoryExpander requestId={request.id} /> : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function MyLeavesPage() {
  const { user } = useAuth()
  const isHrAdmin = user?.role === 'HR_ADMIN'
  const [modalOpen, setModalOpen] = useState(false)
  const { toast, showToast, dismissToast } = useToast()
  const balancesQuery = useDashboardBalances()
  const historyQuery = useMyLeaveRequests()

  const showSubmitSuccessToast = useCallback(() => {
    showToast('Leave request submitted — waiting for approval')
  }, [showToast])

  return (
    <div className="page page-wide" data-testid="my-leaves-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">My Leaves</h1>
          <p className="page-sub">Your leave history and balances</p>
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

      <section className="my-leaves-balances" aria-labelledby="my-leaves-balances-title">
        <h2 id="my-leaves-balances-title" className="my-leaves-section-title">
          Balances
        </h2>
        {balancesQuery.isPending && (
          <div className="balance-grid" data-testid="my-leaves-balance-grid-loading">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="dashboard-skeleton-card" />
            ))}
          </div>
        )}

        {balancesQuery.isError && (
          <p className="dashboard-error" data-testid="my-leaves-balances-error">
            Unable to load your leave balances.
          </p>
        )}

        {balancesQuery.isSuccess && (
          <div className="balance-grid" data-testid="my-leaves-balance-grid">
            {balancesQuery.data.map((balance) => (
              <BalanceCard key={balance.leaveTypeId} balance={balance} />
            ))}
          </div>
        )}
      </section>

      <section className="card my-leaves-history" aria-labelledby="my-leaves-history-title">
        <div className="card-header">
          <h2 id="my-leaves-history-title" className="card-title">
            Leave History
          </h2>
        </div>

        {historyQuery.isPending && (
          <div className="dashboard-section-loading" data-testid="my-leaves-history-loading">
            Loading leave history...
          </div>
        )}

        {historyQuery.isError && (
          <p className="dashboard-error" data-testid="my-leaves-history-error">
            Unable to load your leave history.
          </p>
        )}

        {historyQuery.isSuccess && (
          <HistoryTable requests={historyQuery.data} showAuditHistory={isHrAdmin} />
        )}
      </section>

      <RequestLeaveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={showSubmitSuccessToast}
      />

      <Toast toast={toast} onDismiss={dismissToast} testId="submit-success-toast" />
    </div>
  )
}
