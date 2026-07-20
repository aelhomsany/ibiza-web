import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { PresenceBadge } from '../../components/ui/PresenceBadge'
import { SunIcon } from '../../components/ui/icons'
import type { OutTodayResponse, UpcomingAbsenceResponse } from '../../api/generated/types'
import { chipColorStyle } from '../../utils/entityColor'

type Props = {
  outToday: OutTodayResponse[]
  upcoming: UpcomingAbsenceResponse[]
  isOutTodayLoading?: boolean
  isUpcomingLoading?: boolean
  isOutTodayError?: boolean
  isUpcomingError?: boolean
}

function formatDate(iso: string, locale: string): string {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

export function OutTodaySidebar({
  outToday,
  upcoming,
  isOutTodayLoading,
  isUpcomingLoading,
  isOutTodayError,
  isUpcomingError,
}: Props) {
  const { t, i18n } = useTranslation('dashboard')
  return (
    <aside data-testid="out-today-sidebar" className="dash-sidebar">
      <div className="mini-card">
        <h3 className="mini-title">{t('sidebar.outToday')}</h3>
        {isOutTodayLoading ? (
          <p className="dashboard-section-loading">{t('sidebar.loading')}</p>
        ) : isOutTodayError ? (
          <p className="dashboard-error">{t('errors.outToday')}</p>
        ) : outToday.length === 0 ? (
          <p className="sidebar-empty">
            {t('sidebar.everyoneIn')} <SunIcon size={13} />
          </p>
        ) : (
          outToday.map((row) => (
            <div key={row.userId} className="person-row" data-testid={`out-today-row-${row.userId}`}>
              <div
                className="person-avatar"
                style={chipColorStyle(row.userId ?? 0) as CSSProperties}
                aria-hidden="true"
              >
                {row.initials}
              </div>
              <div className="person-details">
                <div className="person-name">{row.fullName}</div>
                <div className="person-sub">
                  {row.leaveTypeIcon} {row.leaveTypeName}
                </div>
              </div>
              <PresenceBadge presence={row.presence} />
            </div>
          ))
        )}
      </div>

      <div className="mini-card">
        <h3 className="mini-title">{t('sidebar.upcoming')}</h3>
        {isUpcomingLoading ? (
          <p className="dashboard-section-loading">{t('sidebar.loading')}</p>
        ) : isUpcomingError ? (
          <p className="dashboard-error">{t('errors.upcoming')}</p>
        ) : upcoming.length === 0 ? (
          <p className="sidebar-empty">{t('sidebar.noUpcoming')}</p>
        ) : (
          upcoming.map((row) => (
            <div key={row.id} className="person-row">
              <div
                className="person-avatar"
                style={chipColorStyle(row.userId ?? 0) as CSSProperties}
                aria-hidden="true"
              >
                {row.fullName
                  ?.split(/\s+/)
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="person-details">
                <div className="person-name">{row.fullName}</div>
                <div className="person-sub">
                  {formatDate(row.dateFrom ?? '', i18n.language)} · {t('sidebar.workingDays', { count: row.workingDays })}
                </div>
              </div>
              <span className="upcoming-icon" aria-hidden="true">
                {row.leaveTypeIcon}
              </span>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
