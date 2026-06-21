import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../api/client'
import { ApprovalRow } from './ApprovalRow'
import { DeclineModal } from './DeclineModal'
import { RecentDecisionRow } from './RecentDecisionRow'
import { useApproveRequest } from './useApproveRequest'
import { useDeclineRequest } from './useDeclineRequest'
import { usePendingApprovals } from './usePendingApprovals'
import { useRecentApprovalDecisions } from './useRecentApprovalDecisions'
import '../../styles/app-toast.css'
import './approvals.css'

const MANAGER_SUBTITLE = "Review and action your team's leave requests"
const HR_SUBTITLE = 'Review all requests — you can approve on behalf of any manager'

type DeclineTarget = {
  requestId: number
  employeeUserId: number
  employeeName: string
}

export function ApprovalsPage() {
  const { user } = useAuth()
  const { data: pendingApprovals = [], isPending, isError } = usePendingApprovals()
  const {
    data: recentDecisions = [],
    isPending: isRecentPending,
    isError: isRecentError,
  } = useRecentApprovalDecisions()
  const approveMutation = useApproveRequest()
  const declineMutation = useDeclineRequest()
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [errorToast, setErrorToast] = useState<string | null>(null)
  const [declineTarget, setDeclineTarget] = useState<DeclineTarget | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [declineSubmitError, setDeclineSubmitError] = useState<string | null>(null)
  const isHrAdmin = user?.role === 'HR_ADMIN'
  const subtitle = isHrAdmin ? HR_SUBTITLE : MANAGER_SUBTITLE

  const showSuccessToast = useCallback((message: string) => {
    setSuccessToast(message)
  }, [])

  useEffect(() => {
    if (!successToast && !errorToast) {
      return undefined
    }
    const timer = window.setTimeout(() => {
      setSuccessToast(null)
      setErrorToast(null)
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [successToast, errorToast])

  const resolveMutationError = (error: unknown, fallback: string): string => {
    if (error instanceof ApiError) {
      return error.problem.detail ?? fallback
    }
    return fallback
  }

  const handleApprove = (requestId: number, employeeUserId: number, employeeName: string) => {
    approveMutation.mutate(
      { requestId, employeeUserId },
      {
        onSuccess: () => {
          setErrorToast(null)
          showSuccessToast(`${employeeName}'s request approved`)
        },
        onError: (error) => {
          setSuccessToast(null)
          setErrorToast(resolveMutationError(error, 'Unable to approve request'))
        },
      },
    )
  }

  const handleDeclineConfirm = (reason: string) => {
    if (!declineTarget) {
      return
    }
    setDeclineSubmitError(null)
    declineMutation.mutate(
      {
        requestId: declineTarget.requestId,
        employeeUserId: declineTarget.employeeUserId,
        reason,
      },
      {
        onSuccess: () => {
          setDeclineTarget(null)
          setDeclineReason('')
          setDeclineSubmitError(null)
          setErrorToast(null)
          showSuccessToast(`${declineTarget.employeeName}'s request declined`)
        },
        onError: (error) => {
          setDeclineSubmitError(resolveMutationError(error, 'Unable to decline request'))
        },
      },
    )
  }

  return (
    <div className="page page-wide" data-testid="approvals-page">
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
          {pendingApprovals.map((approval) => {
            if (approval.requestId == null) {
              return null
            }
            const requestId = approval.requestId
            const employeeUserId = approval.employeeUserId ?? 0
            const employeeName = approval.employeeFullName?.trim() || 'Unknown'
            return (
              <ApprovalRow
                key={requestId}
                approval={approval}
                isApproving={approveMutation.isPending && approveMutation.variables?.requestId === requestId}
                isDeclining={declineMutation.isPending && declineMutation.variables?.requestId === requestId}
                onApprove={() => handleApprove(requestId, employeeUserId, employeeName)}
                onDecline={() => {
                  setDeclineReason('')
                  setDeclineSubmitError(null)
                  setDeclineTarget({ requestId, employeeUserId, employeeName })
                }}
              />
            )
          })}
        </div>
      )}

      <section className="recent-decisions-section" data-testid="recent-decisions-section">
        <h2 className="recent-decisions-title">Recent Decisions</h2>
        {isRecentPending ? (
          <p className="body-text">Loading recent decisions…</p>
        ) : isRecentError ? (
          <div className="approvals-error-state" data-testid="recent-decisions-error" role="alert">
            <p>We couldn’t load recent decisions. Please try again.</p>
          </div>
        ) : recentDecisions.length === 0 ? (
          <div className="recent-decisions-empty" data-testid="recent-decisions-empty">
            <p>No recent decisions yet.</p>
          </div>
        ) : (
          <div className="card table-wrap" data-testid="recent-decisions-table">
            <table className="recent-decisions-table">
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Leave type</th>
                  <th scope="col">Dates</th>
                  <th scope="col">Days</th>
                  <th scope="col">Status</th>
                  <th scope="col">Decided by</th>
                  <th scope="col">Decision date</th>
                  {isHrAdmin ? <th scope="col">Audit</th> : null}
                </tr>
              </thead>
              <tbody>
                {recentDecisions.map((decision) => {
                  if (decision.requestId == null) {
                    return null
                  }
                  return (
                    <RecentDecisionRow
                      key={decision.requestId}
                      decision={decision}
                      showAuditHistory={isHrAdmin}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {declineTarget ? (
        <DeclineModal
          requestId={declineTarget.requestId}
          employeeName={declineTarget.employeeName}
          reason={declineReason}
          onReasonChange={setDeclineReason}
          onConfirm={handleDeclineConfirm}
          onCancel={() => {
            setDeclineTarget(null)
            setDeclineReason('')
            setDeclineSubmitError(null)
          }}
          isSubmitting={declineMutation.isPending}
          submitError={declineSubmitError}
        />
      ) : null}

      {successToast ? (
        <div
          className="app-toast"
          role="status"
          aria-live="polite"
          data-testid="approval-success-toast"
        >
          {successToast}
        </div>
      ) : null}

      {errorToast ? (
        <div
          className="app-toast app-toast-warning"
          role="alert"
          aria-live="assertive"
          data-testid="approval-error-toast"
        >
          {errorToast}
        </div>
      ) : null}
    </div>
  )
}
