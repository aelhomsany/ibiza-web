import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  OutTodayResponse,
  UpcomingAbsenceResponse,
} from '../../api/generated/types'
import { CoverageSummary } from '../../components/ui/CoverageSummary'
import { LoadingState } from '../../components/ui/LoadingState'
import { PresenceBadge } from '../../components/ui/PresenceBadge'
import { SunIcon } from '../../components/ui/icons'
import { chipColorStyle } from '../../utils/entityColor'

type Props = {
  outToday: OutTodayResponse[]
  upcoming: UpcomingAbsenceResponse[]
  isOutTodayLoading?: boolean
  isUpcomingLoading?: boolean
  isOutTodayError?: boolean
  isUpcomingError?: boolean
  onRetryOutToday?: () => void
  onRetryUpcoming?: () => void
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
  onRetryOutToday,
  onRetryUpcoming,
}: Props) {
  const { t, i18n } = useTranslation(['dashboard', 'common'])
  const offToday = outToday.filter((row) => row.presence === 'OFF').length
  const workingFromHomeToday = outToday.filter(
    (row) => row.presence === 'WFH',
  ).length
  const coverageIsLoading = Boolean(isOutTodayLoading || isUpcomingLoading)
  const coverageIsPartial = Boolean(isOutTodayError || isUpcomingError)

  return (
    <aside
      data-testid="out-today-sidebar"
      className="card dash-card coverage-card"
    >
      <div className="card-header">
        <div>
          <p className="dashboard-card-eyebrow">
            {t('dashboard:coverage.eyebrow')}
          </p>
          <h2 className="card-title">{t('dashboard:coverage.title')}</h2>
        </div>
      </div>

      <div className="coverage-card-body">
        <CoverageSummary
          label={t('dashboard:coverage.summaryLabel')}
          offToday={offToday}
          workingFromHomeToday={workingFromHomeToday}
          upcoming={upcoming.length}
          offLabel={t('dashboard:coverage.offToday')}
          workingFromHomeLabel={t(
            'dashboard:coverage.workingFromHomeToday',
          )}
          upcomingLabel={t('dashboard:coverage.nextThirtyDays')}
          stateLabel={t('dashboard:coverage.offState', { count: offToday })}
          isLoading={coverageIsLoading}
          loadingLabel={t('dashboard:coverage.loading')}
          isPartial={coverageIsPartial}
          partialLabel={t('dashboard:coverage.partial')}
        />

        <section
          className="coverage-section"
          aria-labelledby="coverage-today-title"
        >
          <h3 id="coverage-today-title" className="coverage-section-title">
            {t('dashboard:sidebar.outToday')}
          </h3>

          {isOutTodayLoading ? (
            <LoadingState
              label={t('dashboard:coverage.loadingToday')}
              variant="block"
            />
          ) : isOutTodayError ? (
            <div className="dashboard-region-error">
              <p role="alert">{t('dashboard:errors.outToday')}</p>
              {onRetryOutToday ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={onRetryOutToday}
                >
                  {t('common:actions.retry')}
                </button>
              ) : null}
            </div>
          ) : outToday.length === 0 ? (
            <p className="sidebar-empty">
              {t('dashboard:sidebar.everyoneIn')} <SunIcon size={16} />
            </p>
          ) : (
            <ul className="coverage-people">
              {outToday.map((row) => (
                <li
                  key={row.userId}
                  className="person-row"
                  data-testid={`out-today-row-${row.userId}`}
                >
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
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="coverage-section"
          aria-labelledby="coverage-upcoming-title"
        >
          <h3 id="coverage-upcoming-title" className="coverage-section-title">
            {t('dashboard:sidebar.upcoming')}
          </h3>

          {isUpcomingLoading ? (
            <LoadingState
              label={t('dashboard:coverage.loadingUpcoming')}
              variant="block"
            />
          ) : isUpcomingError ? (
            <div className="dashboard-region-error">
              <p role="alert">{t('dashboard:errors.upcoming')}</p>
              {onRetryUpcoming ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={onRetryUpcoming}
                >
                  {t('common:actions.retry')}
                </button>
              ) : null}
            </div>
          ) : upcoming.length === 0 ? (
            <p className="sidebar-empty">
              {t('dashboard:sidebar.noUpcoming')}
            </p>
          ) : (
            <ul className="coverage-people">
              {upcoming.map((row) => (
                <li key={row.id} className="person-row">
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
                      <bdi>
                        {formatDate(row.dateFrom ?? '', i18n.language)}
                      </bdi>
                      {' · '}
                      {t('dashboard:sidebar.workingDays', {
                        count: row.workingDays,
                      })}
                    </div>
                  </div>
                  <span className="upcoming-icon" aria-hidden="true">
                    {row.leaveTypeIcon}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  )
}
