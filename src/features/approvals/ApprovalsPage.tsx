import { useAuth } from '../../auth/useAuth'
import { ApprovalRow } from './ApprovalRow'
import { usePendingApprovals } from './usePendingApprovals'
import './approvals.css'

const MANAGER_SUBTITLE = "Review and action your team's leave requests"
const HR_SUBTITLE = 'Review all requests — you can approve on behalf of any manager'

export function ApprovalsPage() {
  const { user } = useAuth()
  const { data: pendingApprovals = [], isPending, isError } = usePendingApprovals()
  const isHrAdmin = user?.role === 'HR_ADMIN'
  const subtitle = isHrAdmin ? HR_SUBTITLE : MANAGER_SUBTITLE

  return (
    <div className="page" data-testid="approvals-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Approvals</h1>
          <p className="page-sub">{subtitle}</p>
        </div>
      </header>

      {isPending ? (
        <p className="body-text">Loading pending requests…</p>
      ) : isError ? (
        <div className="approvals-error-state" data-testid="approvals-error-state" role="alert">
          <p>We couldn’t load pending requests. Please try again.</p>
        </div>
      ) : pendingApprovals.length === 0 ? (
        <div className="approvals-empty-state" data-testid="approvals-empty-state">
          <div aria-hidden="true" style={{ fontSize: '40px' }}>
            ✅
          </div>
          <p>All caught up!</p>
        </div>
      ) : (
        <div className="approvals-card" data-testid="approvals-pending-list">
          {pendingApprovals.map((approval) => (
            <ApprovalRow key={approval.requestId} approval={approval} />
          ))}
        </div>
      )}
    </div>
  )
}
