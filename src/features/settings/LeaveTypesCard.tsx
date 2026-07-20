import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { getLeaveTypes } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import './team-members.css'

type LeaveTypesCardProps = {
  onWarning?: (message: string) => void
}

function formatDefaultBalance(defaultBalanceDays: number | null | undefined, t: (key: string, options?: { count: number }) => string): string {
  if (defaultBalanceDays != null) {
    return t('leaveTypes.defaultDays', { count: defaultBalanceDays })
  }
  return t('leaveTypes.unlimited')
}

export function LeaveTypesCard({ onWarning }: LeaveTypesCardProps) {
  const { t } = useTranslation('settings')
  const { user } = useAuth()
  const orgId = user?.organizationId

  const leaveTypesQuery = useQuery({
    queryKey: ['leave-types', orgId],
    queryFn: getLeaveTypes,
    enabled: orgId != null,
  })

  useEffect(() => {
    if (leaveTypesQuery.isError) {
      onWarning?.(t('leaveTypes.errors.loadToast'))
    }
  }, [leaveTypesQuery.isError, onWarning, t])

  if (leaveTypesQuery.isPending) {
    return (
      <section className="settings-card settings-card-spaced" data-testid="leave-types-card">
        <div className="card-section-header">
          <span className="card-section-title">{t('leaveTypes.title')}</span>
        </div>
        <p className="settings-card-loading-inline">{t('leaveTypes.loading')}</p>
      </section>
    )
  }

  if (leaveTypesQuery.isError) {
    return (
      <section className="settings-card settings-card-spaced" data-testid="leave-types-card">
        <div className="card-section-header">
          <span className="card-section-title">{t('leaveTypes.title')}</span>
        </div>
        <p className="settings-card-error-inline">{t('leaveTypes.errors.load')}</p>
      </section>
    )
  }

  const leaveTypes = leaveTypesQuery.data ?? []

  return (
    <section className="settings-card settings-card-spaced" data-testid="leave-types-card">
      <div className="card-section-header">
        <span className="card-section-title">{t('leaveTypes.title')}</span>
      </div>

      {leaveTypes.length === 0 ? (
        <p className="settings-card-loading-inline">{t('leaveTypes.none')}</p>
      ) : (
        <div className="settings-list-body" data-testid="leave-types-list">
          {leaveTypes.map((leaveType) => (
            <div
              key={leaveType.id}
              className="settings-list-item leave-type-row"
              data-testid={`leave-type-row-${leaveType.id}`}
            >
              <span className="leave-type-icon" aria-hidden="true">
                {leaveType.icon}
              </span>
              <div className="leave-type-details">
                <div className="leave-type-name">{leaveType.name}</div>
                <div className="leave-type-subtitle">
                  {formatDefaultBalance(leaveType.defaultBalanceDays ?? null, t)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
