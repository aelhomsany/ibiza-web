import { LeaveStatusBadge } from '../../components/ui/LeaveStatusBadge'
import { useTranslation } from 'react-i18next'
import { InboxIcon } from '../../components/ui/icons'
import { HorizontalScrollRegion } from '../../components/ui/HorizontalScrollRegion'
import type { RecentRequestResponse } from '../../api/generated/types'
import { LeaveTypeTag } from './LeaveTypeTag'
import { formatDateRange } from './leaveRequestFormatting'

type Props = {
  requests: RecentRequestResponse[]
  isLoading?: boolean
  isError?: boolean
}

export function RecentRequestsCard({ requests, isLoading, isError }: Props) {
  const { t, i18n } = useTranslation('dashboard')
  const titleId = 'recent-requests-title'
  if (isLoading) {
    return (
      <div className="card" data-testid="recent-requests-card">
        <div className="card-header">
          <h2 id={titleId} className="card-title">{t('recent.title')}</h2>
        </div>
        <div className="dashboard-section-loading">{t('recent.loading')}</div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card" data-testid="recent-requests-card">
        <div className="card-header">
          <h2 id={titleId} className="card-title">{t('recent.title')}</h2>
        </div>
        <p className="dashboard-error" data-testid="recent-requests-error">
          {t('errors.recent')}
        </p>
      </div>
    )
  }

  return (
    <div className="card" data-testid="recent-requests-card">
      <div className="card-header">
        <h2 id={titleId} className="card-title">{t('recent.title')}</h2>
      </div>
      {requests.length === 0 ? (
        <div className="dashboard-empty-state">
          <span className="dashboard-empty-icon" aria-hidden="true">
            <InboxIcon size={36} />
          </span>
          <p>{t('recent.empty')}</p>
        </div>
      ) : (
        <HorizontalScrollRegion
          labelledBy={titleId}
          describedById="recent-requests-scroll-hint"
        >
          <table className="dashboard-table">
            <thead>
              <tr>
                <th scope="col">{t('table.type')}</th>
                <th scope="col">{t('table.dates')}</th>
                <th scope="col">{t('table.days')}</th>
                <th scope="col">{t('table.status')}</th>
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
                    <LeaveStatusBadge status={request.status} />
                    {request.status === 'PENDING' && request.statusHint && (
                      <div className="status-hint">{request.statusHint}</div>
                    )}
                    {request.status === 'DECLINED' && request.declineReason && (
                      <div className="decline-reason">&quot;{request.declineReason}&quot;</div>
                    )}
                    {request.status === 'APPROVED' && request.statusHint && (
                      <div className="status-hint">{request.statusHint}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </HorizontalScrollRegion>
      )}
    </div>
  )
}
