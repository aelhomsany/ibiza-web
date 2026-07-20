import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../api/client'
import { useToast } from '../../components/ui/useToast'
import { CheckCircleIcon } from '../../components/ui/icons'
import { LoadingState } from '../../components/ui/LoadingState'
import { HorizontalScrollRegion } from '../../components/ui/HorizontalScrollRegion'
import { ApprovalRow } from './ApprovalRow'
import { DeclineModal } from './DeclineModal'
import { RecentDecisionRow } from './RecentDecisionRow'
import { useApproveRequest } from './useApproveRequest'
import { useDeclineRequest } from './useDeclineRequest'
import { usePendingApprovals } from './usePendingApprovals'
import { useRecentApprovalDecisions } from './useRecentApprovalDecisions'
import '../dashboard/dashboard.css'
import './approvals.css'

type DeclineTarget = {
  requestId: number
  employeeUserId: number
  employeeName: string
}

export function ApprovalsPage() {
  const { t } = useTranslation(['approvals', 'layout', 'common'])
  const { user } = useAuth()
  const { data: pendingApprovals = [], isPending, isError } = usePendingApprovals()
  const {
    data: recentDecisions = [],
    isPending: isRecentPending,
    isError: isRecentError,
  } = useRecentApprovalDecisions()
  const approveMutation = useApproveRequest()
  const declineMutation = useDeclineRequest()
  const { showToast } = useToast()
  const [declineTarget, setDeclineTarget] = useState<DeclineTarget | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [declineSubmitError, setDeclineSubmitError] = useState<string | null>(null)
  const isHrAdmin = user?.role === 'HR_ADMIN'
  const subtitle = isHrAdmin ? t('approvals:subtitle.hr') : t('approvals:subtitle.manager')

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
          showToast(t('approvals:success.approved', { name: employeeName }))
        },
        onError: (error) => {
          showToast(resolveMutationError(error, t('approvals:errors.approve')), 'warning')
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
          showToast(t('approvals:success.declined', { name: declineTarget.employeeName }))
        },
        onError: (error) => {
          setDeclineSubmitError(resolveMutationError(error, t('approvals:errors.decline')))
        },
      },
    )
  }

  return (
    <div className="page page-wide" data-testid="approvals-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('approvals:title')}</h1>
          <p className="page-sub">{subtitle}</p>
        </div>
      </header>

      {isPending ? (
        <LoadingState
          label={t('layout:loading.pendingApprovals')}
          testId="approvals-pending-loading"
        />
      ) : isError ? (
        <div className="approvals-error-state" data-testid="approvals-error-state" role="alert">
          <p>{t('approvals:errors.pending')}</p>
        </div>
      ) : pendingApprovals.length === 0 ? (
        <div className="approvals-empty-state" data-testid="approvals-empty-state" role="status">
          <div aria-hidden="true" className="approvals-empty-icon">
            <CheckCircleIcon size={40} />
          </div>
          <p>{t('approvals:empty')}</p>
        </div>
      ) : (
        <div className="approvals-card" data-testid="approvals-pending-list">
          {pendingApprovals.map((approval) => {
            if (approval.requestId == null) {
              return null
            }
            const requestId = approval.requestId
            const employeeUserId = approval.employeeUserId ?? 0
            const employeeName = approval.employeeFullName?.trim() || t('common:unknown')
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
        <h2 id="recent-decisions-title" className="recent-decisions-title">
          {t('approvals:recent.title')}
        </h2>
        {isRecentPending ? (
          <LoadingState
            label={t('layout:loading.recentDecisions')}
            testId="approvals-recent-loading"
          />
        ) : isRecentError ? (
          <div className="approvals-error-state" data-testid="recent-decisions-error" role="alert">
            <p>{t('approvals:errors.recent')}</p>
          </div>
        ) : recentDecisions.length === 0 ? (
          <div className="recent-decisions-empty" data-testid="recent-decisions-empty" role="status">
            <p>{t('approvals:recent.empty')}</p>
          </div>
        ) : (
          <HorizontalScrollRegion
            className="card table-wrap"
            testId="recent-decisions-table"
            labelledBy="recent-decisions-title"
            describedById="recent-decisions-scroll-hint"
          >
            <table className="recent-decisions-table">
              <thead>
                <tr>
                  <th scope="col">{t('approvals:table.employee')}</th>
                  <th scope="col">{t('approvals:table.leaveType')}</th>
                  <th scope="col">{t('approvals:table.dates')}</th>
                  <th scope="col">{t('approvals:table.days')}</th>
                  <th scope="col">{t('approvals:table.status')}</th>
                  <th scope="col">{t('approvals:table.decidedBy')}</th>
                  <th scope="col">{t('approvals:table.decisionDate')}</th>
                  {isHrAdmin ? <th scope="col">{t('approvals:table.audit')}</th> : null}
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
          </HorizontalScrollRegion>
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
    </div>
  )
}
