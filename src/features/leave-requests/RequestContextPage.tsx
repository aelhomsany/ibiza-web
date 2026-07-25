import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { LeaveStatusBadge } from '../../components/ui/LeaveStatusBadge'
import { AuditHistoryExpander } from '../approvals/AuditHistoryExpander'
import { LeaveTypeTag } from '../dashboard/LeaveTypeTag'
import { formatDateRange } from '../dashboard/leaveRequestFormatting'
import { useLeaveRequestContext } from './useLeaveRequestContext'
import './request-context.css'

function parseRequestId(id: string | undefined): number | undefined {
  if (!id) {
    return undefined
  }
  const parsed = Number(id)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

export function RequestContextPage() {
  const { t, i18n } = useTranslation('leaves')
  const { id } = useParams()
  const requestId = parseRequestId(id)
  const { user } = useAuth()
  const isHrAdmin = user?.role === 'HR_ADMIN'
  const query = useLeaveRequestContext(requestId)

  if (requestId == null) {
    return (
      <div className="page page-wide" data-testid="request-context-page">
        <section className="card request-context-card">
          <h1 className="card-title">{t('requestContext.notFound')}</h1>
          <p className="dashboard-error">{t('requestContext.invalid')}</p>
          <Link className="btn btn-primary request-context-back-link" to="/calendar">
            {t('actions.backCalendar')}
          </Link>
        </section>
      </div>
    )
  }

  if (query.isPending) {
    return (
      <div className="page page-wide" data-testid="request-context-page">
        <div className="dashboard-section-loading" data-testid="request-context-loading">
          {t('requestContext.loading')}
        </div>
      </div>
    )
  }

  if (query.isError) {
    const detail =
      query.error instanceof ApiError
        ? (query.error.problem.detail ?? t('requestContext.unavailable'))
        : t('requestContext.unavailable')

    return (
      <div className="page page-wide" data-testid="request-context-page">
        <section className="card request-context-card">
          <h1 className="card-title">{t('requestContext.notFound')}</h1>
          <p className="dashboard-error" data-testid="request-context-error">
            {detail}
          </p>
          <div className="request-context-actions">
            <Link className="btn btn-primary request-context-back-link" to="/calendar">
              {t('actions.backCalendar')}
            </Link>
            <Link className="btn request-context-back-link" to="/my-leaves">
              {t('actions.myLeaves')}
            </Link>
          </div>
        </section>
      </div>
    )
  }

  const request = query.data

  return (
    <div className="page page-wide" data-testid="request-context-page">
      <header className="page-header request-context-header">
        <div>
          <p className="page-kicker">{t('requestContext.kicker')}</p>
          <h1 className="page-title">{request.leaveTypeName}</h1>
          <p className="page-sub">{request.requesterFullName}</p>
        </div>
        <Link className="btn request-context-back-link" to="/calendar">
          {t('actions.backCalendar')}
        </Link>
      </header>

      <section className="card request-context-card" aria-labelledby="request-context-title">
        <div className="card-header">
          <h2 id="request-context-title" className="card-title">
            {t('requestContext.details')}
          </h2>
        </div>

        <dl className="request-context-summary">
          <div>
            <dt>{t('requestContext.leaveType')}</dt>
            <dd>
              <LeaveTypeTag
                icon={request.leaveTypeIcon ?? ''}
                name={request.leaveTypeName ?? ''}
                color={request.leaveTypeColor ?? 'inherit'}
                backgroundColor={request.leaveTypeBackgroundColor ?? 'transparent'}
                borderColor={request.leaveTypeBorderColor ?? 'transparent'}
              />
            </dd>
          </div>
          <div>
            <dt>{t('requestContext.requester')}</dt>
            <dd>{request.requesterFullName}</dd>
          </div>
          <div>
            <dt>{t('requestContext.dates')}</dt>
            <dd>{formatDateRange(request.dateFrom ?? '', request.dateTo ?? '', i18n.language)}</dd>
          </div>
          <div>
            <dt>{t('requestContext.workingDays')}</dt>
            <dd>{t('requestContext.workingDaysValue', { count: request.workingDays })}</dd>
          </div>
          <div>
            <dt>{t('requestContext.status')}</dt>
            <dd>
              <LeaveStatusBadge status={request.status} />
              {request.statusHint ? <span className="status-hint">{request.statusHint}</span> : null}
              {request.status === 'DECLINED' && request.declineReason ? (
                <span className="decline-reason">&quot;{request.declineReason}&quot;</span>
              ) : null}
            </dd>
          </div>
          {isHrAdmin && request.id != null ? (
            <div>
              <dt>{t('requestContext.audit')}</dt>
              <dd>
                <AuditHistoryExpander requestId={request.id} />
              </dd>
            </div>
          ) : null}
        </dl>
      </section>
    </div>
  )
}
