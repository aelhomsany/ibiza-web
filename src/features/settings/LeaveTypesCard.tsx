import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getLeaveTypes } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import './team-members.css'

type LeaveTypesCardProps = {
  onWarning?: (message: string) => void
}

function formatDefaultBalance(defaultBalanceDays: number | null | undefined): string {
  if (defaultBalanceDays != null) {
    return `${defaultBalanceDays} days default`
  }
  return 'Unlimited / custom'
}

export function LeaveTypesCard({ onWarning }: LeaveTypesCardProps) {
  const { user } = useAuth()
  const orgId = user?.organizationId

  const leaveTypesQuery = useQuery({
    queryKey: ['leave-types', orgId],
    queryFn: getLeaveTypes,
    enabled: orgId != null,
  })

  useEffect(() => {
    if (leaveTypesQuery.isError) {
      onWarning?.('Unable to load leave types')
    }
  }, [leaveTypesQuery.isError, onWarning])

  if (leaveTypesQuery.isPending) {
    return (
      <section className="settings-card settings-card-spaced" data-testid="leave-types-card">
        <div className="card-section-header">
          <span className="card-section-title">Leave Types</span>
        </div>
        <p className="settings-card-loading-inline">Loading leave types…</p>
      </section>
    )
  }

  if (leaveTypesQuery.isError) {
    return (
      <section className="settings-card settings-card-spaced" data-testid="leave-types-card">
        <div className="card-section-header">
          <span className="card-section-title">Leave Types</span>
        </div>
        <p className="settings-card-error-inline">Unable to load leave types.</p>
      </section>
    )
  }

  const leaveTypes = leaveTypesQuery.data ?? []

  return (
    <section className="settings-card settings-card-spaced" data-testid="leave-types-card">
      <div className="card-section-header">
        <span className="card-section-title">Leave Types</span>
      </div>

      {leaveTypes.length === 0 ? (
        <p className="settings-card-loading-inline">No leave types configured yet.</p>
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
                  {formatDefaultBalance(leaveType.defaultBalanceDays ?? null)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
