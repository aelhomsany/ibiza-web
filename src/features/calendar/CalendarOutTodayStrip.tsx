import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadingState } from '../../components/ui/LoadingState'
import { PresenceBadge } from '../../components/ui/PresenceBadge'
import { SunIcon } from '../../components/ui/icons'
import { chipColorStyle } from '../../utils/entityColor'
import { useDashboardOutToday } from '../dashboard/useDashboardOutToday'

/**
 * "Out today" strip for the Team Calendar landing page (Dashboard merge,
 * 2026-09-01): the calendar is the post-login home, so who is away today has
 * to be answerable without scanning the timeline. Reuses the out-today feed
 * and its i18n keys from the dashboard namespace; WFH renders as present
 * (dashed badge), never as away.
 */
export function CalendarOutTodayStrip() {
  const { t } = useTranslation(['calendar', 'dashboard', 'common'])
  const outTodayQuery = useDashboardOutToday()
  const rows = outTodayQuery.data ?? []

  return (
    <section
      className="calendar-out-today calendar-glass-card"
      data-testid="calendar-out-today"
      aria-labelledby="calendar-out-today-title"
    >
      <h2 id="calendar-out-today-title" className="calendar-out-today-title">
        {t('dashboard:sidebar.outToday')}
      </h2>

      {outTodayQuery.isPending ? (
        <LoadingState
          label={t('dashboard:coverage.loadingToday')}
          variant="block"
        />
      ) : outTodayQuery.isError ? (
        <div className="calendar-out-today-error" role="status">
          <p className="calendar-out-today-empty">
            {t('dashboard:errors.outToday')}
          </p>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => void outTodayQuery.refetch()}
          >
            {t('common:actions.retry')}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="calendar-out-today-empty" data-testid="calendar-out-today-empty">
          {t('dashboard:sidebar.everyoneIn')} <SunIcon size={16} />
        </p>
      ) : (
        <ul className="calendar-out-today-list">
          {rows.map((row) => (
            <li
              key={row.userId}
              className="calendar-out-today-person"
              data-testid={`calendar-out-today-${row.userId}`}
            >
              <span
                className="calendar-person-avatar"
                style={chipColorStyle(row.userId ?? 0) as CSSProperties}
                aria-hidden="true"
              >
                {row.initials ?? '?'}
              </span>
              <span className="calendar-out-today-copy">
                {/* Story 16.2: identity and Leave Type are privacy-projected
                    and may be absent — fall back to the localized redactions. */}
                <span className="calendar-out-today-name" dir="auto">
                  {row.fullName ?? t('dashboard:redacted.person')}
                </span>
                <span className="calendar-out-today-type" dir="auto">
                  {row.leaveTypeName
                    ? `${row.leaveTypeIcon ?? ''} ${row.leaveTypeName}`.trim()
                    : t('dashboard:redacted.leaveType')}
                </span>
              </span>
              <PresenceBadge presence={row.presence} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
