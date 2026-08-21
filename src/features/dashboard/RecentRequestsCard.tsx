import { LeaveStatusBadge } from '../../components/ui/LeaveStatusBadge'
import { useTranslation } from 'react-i18next'
import { InboxIcon, PlusIcon } from '../../components/ui/icons'
import { HorizontalScrollRegion } from '../../components/ui/HorizontalScrollRegion'
import { LoadingState } from '../../components/ui/LoadingState'
import type { RecentRequestResponse } from '../../api/generated/types'
import { LeaveTypeTag } from './LeaveTypeTag'
import {
  formatDateRange,
  localizedRequestStatusHint,
} from './leaveRequestFormatting'

type Props = {
  requests: RecentRequestResponse[]
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  onRequestLeave?: () => void
}

function RequestHint({ request }: { request: RecentRequestResponse }) {
  const { t } = useTranslation('dashboard')
  if (request.status === 'DECLINED' && request.declineReason) {
    return (
      <p className="decline-reason recent-request-hint" dir="auto">
        &quot;{request.declineReason}&quot;
      </p>
    )
  }
  const hint = localizedRequestStatusHint(request, t)
  if (hint) {
    return <p className="status-hint recent-request-hint">{hint}</p>
  }
  return null
}

export function RecentRequestsCard({
  requests,
  isLoading,
  isError,
  onRetry,
  onRequestLeave,
}: Props) {
  const { t, i18n } = useTranslation(['dashboard', 'common'])
  const titleId = 'recent-requests-title'
  if (isLoading) {
    return (
      <div className="card dash-card" data-testid="recent-requests-card">
        <div className="card-header">
          <h2 id={titleId} className="card-title">
            {t('dashboard:recent.title')}
          </h2>
        </div>
        <LoadingState
          label={t('dashboard:recent.loading')}
          variant="block"
          testId="recent-requests-loading"
        />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card dash-card" data-testid="recent-requests-card">
        <div className="card-header">
          <h2 id={titleId} className="card-title">
            {t('dashboard:recent.title')}
          </h2>
        </div>
        <div className="dashboard-region-error" data-testid="recent-requests-error">
          <p role="alert">{t('dashboard:errors.recent')}</p>
          {onRetry ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
              {t('common:actions.retry')}
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="card dash-card" data-testid="recent-requests-card">
      <div className="card-header">
        <div>
          <p className="dashboard-card-eyebrow">{t('dashboard:recent.eyebrow')}</p>
          <h2 id={titleId} className="card-title">
            {t('dashboard:recent.title')}
          </h2>
        </div>
      </div>
      {requests.length === 0 ? (
        <div className="dashboard-empty-state">
          <span className="dashboard-empty-icon" aria-hidden="true">
            <InboxIcon size={36} />
          </span>
          <p className="dashboard-empty-title">{t('dashboard:recent.emptyTitle')}</p>
          <p>{t('dashboard:recent.empty')}</p>
          {onRequestLeave ? (
            <button
              type="button"
              className="btn btn-outline dashboard-empty-action"
              onClick={onRequestLeave}
            >
              <PlusIcon size={16} /> {t('dashboard:actions.requestLeave')}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div
            className="recent-requests-table-view"
            data-testid="recent-requests-table-view"
          >
            <HorizontalScrollRegion
              labelledBy={titleId}
              describedById="recent-requests-scroll-hint"
              testId="recent-requests-scroll-region"
            >
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th scope="col">{t('dashboard:table.type')}</th>
                    <th scope="col">{t('dashboard:table.dates')}</th>
                    <th scope="col">{t('dashboard:table.days')}</th>
                    <th scope="col">{t('dashboard:table.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr
                      key={request.id}
                      className={request.status === 'PENDING' ? 'row-pending' : undefined}
                      data-testid={`recent-request-row-${request.id}`}
                    >
                      <td>
                        <LeaveTypeTag
                          icon={request.leaveTypeIcon ?? ''}
                          name={request.leaveTypeName ?? ''}
                          color={request.leaveTypeColor ?? 'inherit'}
                          backgroundColor={
                            request.leaveTypeBackgroundColor ?? 'transparent'
                          }
                          borderColor={request.leaveTypeBorderColor ?? 'transparent'}
                        />
                      </td>
                      <td>
                        {formatDateRange(
                          request.dateFrom ?? '',
                          request.dateTo ?? '',
                          i18n.language,
                        )}
                      </td>
                      <td>
                        <strong>{request.workingDays}</strong>{' '}
                        <span className="working-caption">
                          {t('dashboard:table.working')}
                        </span>
                      </td>
                      <td>
                        <LeaveStatusBadge status={request.status} />
                        <RequestHint request={request} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </HorizontalScrollRegion>
          </div>

          <ul className="recent-request-list" data-testid="recent-request-card-list">
            {requests.map((request) => (
              <li
                className="recent-request-card"
                data-testid={`recent-request-card-${request.id}`}
                key={request.id}
              >
                <div className="recent-request-card-heading">
                  <LeaveTypeTag
                    icon={request.leaveTypeIcon ?? ''}
                    name={request.leaveTypeName ?? ''}
                    color={request.leaveTypeColor ?? 'inherit'}
                    backgroundColor={request.leaveTypeBackgroundColor ?? 'transparent'}
                    borderColor={request.leaveTypeBorderColor ?? 'transparent'}
                  />
                  <LeaveStatusBadge status={request.status} />
                </div>
                <p className="recent-request-dates">
                  <bdi>
                    {formatDateRange(
                      request.dateFrom ?? '',
                      request.dateTo ?? '',
                      i18n.language,
                    )}
                  </bdi>
                </p>
                <p className="recent-request-working-days">
                  {t('dashboard:valueProof.workingDays', {
                    count: request.workingDays,
                  })}
                </p>
                <RequestHint request={request} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
