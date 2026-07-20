import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RecentRequestResponse } from '../../api/generated/types'
import { useAuth } from '../../auth/useAuth'
import { LeaveStatusBadge } from '../../components/ui/LeaveStatusBadge'
import { LoadingState } from '../../components/ui/LoadingState'
import { PlusIcon } from '../../components/ui/icons'
import { HorizontalScrollRegion } from '../../components/ui/HorizontalScrollRegion'
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
  const { t, i18n } = useTranslation('leaves')
  if (requests.length === 0) {
    return (
      <div className="dashboard-empty-state" data-testid="my-leaves-empty-state" role="status">
        <p>{t('history.empty')}</p>
      </div>
    )
  }

  return (
    <HorizontalScrollRegion
      labelledBy="my-leaves-history-title"
      describedById="my-leaves-history-scroll-hint"
      testId="my-leaves-history-table"
    >
      <table className="dashboard-table">
        <thead>
          <tr>
            <th scope="col">{t('table.type')}</th>
            <th scope="col">{t('table.dates')}</th>
            <th scope="col">{t('table.days')}</th>
            <th scope="col">{t('table.status')}</th>
            {showAuditHistory ? <th scope="col">{t('table.audit')}</th> : null}
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
              <td>{formatDateRange(request.dateFrom ?? '', request.dateTo ?? '', i18n.language)}</td>
              <td>
                <strong>{request.workingDays}</strong>{' '}
                <span className="working-caption">{t('table.working')}</span>
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
    </HorizontalScrollRegion>
  )
}

export function MyLeavesPage() {
  const { t } = useTranslation(['leaves', 'layout', 'dashboard'])
  const { user } = useAuth()
  const isHrAdmin = user?.role === 'HR_ADMIN'
  const [modalOpen, setModalOpen] = useState(false)
  const { showToast } = useToast()
  const balancesQuery = useDashboardBalances()
  const historyQuery = useMyLeaveRequests()

  const showSubmitSuccessToast = useCallback(() => {
    showToast(t('dashboard:request.success'))
  }, [showToast, t])

  return (
    <div className="page page-wide" data-testid="my-leaves-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('leaves:title')}</h1>
          <p className="page-sub">{t('leaves:subtitle')}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="request-leave-btn"
          onClick={() => setModalOpen(true)}
        >
          <PlusIcon size={16} /> {t('leaves:actions.requestLeave')}
        </button>
      </header>

      <section className="my-leaves-balances" aria-labelledby="my-leaves-balances-title">
        <h2 id="my-leaves-balances-title" className="my-leaves-section-title">
          {t('leaves:balances')}
        </h2>
        {balancesQuery.isPending && (
          <LoadingState
            label={t('layout:loading.leaveBalances')}
            variant="skeleton"
            testId="my-leaves-balance-grid-loading"
          >
            <div className="balance-grid">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="dashboard-skeleton-card" />
              ))}
            </div>
          </LoadingState>
        )}

        {balancesQuery.isError && (
          <p className="dashboard-error" data-testid="my-leaves-balances-error" role="alert">
            {t('leaves:errors.balances')}
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

      <section className="card my-leaves-history">
        <div className="card-header">
          <h2 id="my-leaves-history-title" className="card-title">
            {t('leaves:history.title')}
          </h2>
        </div>

        {historyQuery.isPending && (
          <LoadingState
            label={t('layout:loading.leaveHistory')}
            variant="block"
            testId="my-leaves-history-loading"
          />
        )}

        {historyQuery.isError && (
          <p className="dashboard-error" data-testid="my-leaves-history-error" role="alert">
            {t('leaves:errors.history')}
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
    </div>
  )
}
