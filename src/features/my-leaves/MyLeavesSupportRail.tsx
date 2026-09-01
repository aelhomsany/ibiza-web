import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  OutTodayResponse,
  RecentRequestResponse,
  UpcomingAbsenceResponse,
} from '../../api/generated/types'
import { LoadingState } from '../../components/ui/LoadingState'
import { isolate } from '../../i18n/bidi'
import { chipColorStyle } from '../../utils/entityColor'
import {
  formatDateRange,
  localizedRequestStatusHint,
} from '../dashboard/leaveRequestFormatting'

type MyLeavesSupportRailProps = {
  outToday: OutTodayResponse[]
  upcoming: UpcomingAbsenceResponse[]
  isOutTodayLoading?: boolean
  isUpcomingLoading?: boolean
  isOutTodayError?: boolean
  isUpcomingError?: boolean
  onRetryOutToday?: () => void
  onRetryUpcoming?: () => void
  latestRequest?: RecentRequestResponse
  isLatestLoading?: boolean
  workforceGroupName?: string | null
}

function formatDate(iso: string, locale: string): string {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

/**
 * Supporting rail for the merged My Leaves page (Dashboard + My Leaves merge,
 * 2026-09-01). Three notes in the shared support-rail vocabulary:
 *
 * 1. Team coverage — the OFF/WFH/upcoming counts the Dashboard sidebar showed.
 *    Every figure is derived from the same out-today/upcoming responses this
 *    page already fetches; nothing is invented client-side.
 * 2. Upcoming leaves — the same 30-day feed, as person rows.
 * 3. Working-day clarity — the stored (authoritative) working-day total of the
 *    viewer's latest request, with the policy source from /me. Replaces the
 *    old RequestExplainer block; it never derives or recounts days.
 */
export function MyLeavesSupportRail({
  outToday,
  upcoming,
  isOutTodayLoading,
  isUpcomingLoading,
  isOutTodayError,
  isUpcomingError,
  onRetryOutToday,
  onRetryUpcoming,
  latestRequest,
  isLatestLoading,
  workforceGroupName,
}: MyLeavesSupportRailProps) {
  const { t, i18n } = useTranslation(['leaves', 'dashboard', 'common'])
  const offToday = outToday.filter((row) => row.presence === 'OFF').length
  const workingFromHomeToday = outToday.filter(
    (row) => row.presence === 'WFH',
  ).length
  const coverageLoading = Boolean(isOutTodayLoading || isUpcomingLoading)
  const coveragePartial = Boolean(isOutTodayError || isUpcomingError)

  const latestHint = latestRequest
    ? latestRequest.declineReason ?? localizedRequestStatusHint(latestRequest, t)
    : null
  const latestContext = latestRequest
    ? t(
        latestHint
          ? 'leaves:explainer.requestContextWithHint'
          : 'leaves:explainer.requestContext',
        {
          type: latestRequest.leaveTypeName,
          dates: formatDateRange(
            latestRequest.dateFrom ?? '',
            latestRequest.dateTo ?? '',
            i18n.language,
          ),
          hint: latestHint,
        },
      )
    : null

  return (
    <aside
      className="support-rail my-leaves-support-rail"
      data-testid="my-leaves-support-rail"
    >
      <section className="support-note" aria-labelledby="my-leaves-coverage-title">
        <h2 id="my-leaves-coverage-title" className="support-note-title">
          {t('dashboard:coverage.title')}
        </h2>
        {coverageLoading ? (
          <LoadingState label={t('dashboard:coverage.loading')} variant="block" />
        ) : (
          <>
            <dl className="support-note-list">
              <div className="support-note-kv">
                <dt>{t('dashboard:coverage.offToday')}</dt>
                <dd data-testid="my-leaves-rail-off-today">
                  {isOutTodayError ? '—' : offToday}
                </dd>
              </div>
              <div className="support-note-kv">
                <dt>{t('dashboard:coverage.workingFromHomeToday')}</dt>
                <dd data-testid="my-leaves-rail-wfh-today">
                  {isOutTodayError ? '—' : workingFromHomeToday}
                </dd>
              </div>
              <div className="support-note-kv">
                <dt>{t('dashboard:coverage.nextThirtyDays')}</dt>
                <dd data-testid="my-leaves-rail-upcoming-count">
                  {isUpcomingError ? '—' : upcoming.length}
                </dd>
              </div>
            </dl>
            {coveragePartial ? (
              <>
                <p className="support-note-footnote" role="status">
                  {t('dashboard:coverage.partial')}
                </p>
                {isOutTodayError && onRetryOutToday ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm my-leaves-rail-retry"
                    onClick={onRetryOutToday}
                  >
                    {t('common:actions.retry')}
                  </button>
                ) : null}
              </>
            ) : (
              <p className="support-note-footnote">
                {t('leaves:rail.coverageFootnote')}
              </p>
            )}
          </>
        )}
      </section>

      <section className="support-note" aria-labelledby="my-leaves-upcoming-title">
        <h2 id="my-leaves-upcoming-title" className="support-note-title">
          {t('dashboard:sidebar.upcoming')}
        </h2>
        {isUpcomingLoading ? (
          <LoadingState
            label={t('dashboard:coverage.loadingUpcoming')}
            variant="block"
          />
        ) : isUpcomingError ? (
          <>
            <p className="support-note-body" role="alert">
              {t('dashboard:errors.upcoming')}
            </p>
            {onRetryUpcoming ? (
              <button
                type="button"
                className="btn btn-outline btn-sm my-leaves-rail-retry"
                onClick={onRetryUpcoming}
              >
                {t('common:actions.retry')}
              </button>
            ) : null}
          </>
        ) : upcoming.length === 0 ? (
          <p className="support-note-body">{t('dashboard:sidebar.noUpcoming')}</p>
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
                    .toUpperCase() ?? '?'}
                </div>
                <div className="person-details">
                  <div className="person-name" dir="auto">
                    {row.fullName ?? t('dashboard:redacted.person')}
                  </div>
                  <div className="person-sub">
                    <bdi>{formatDate(row.dateFrom ?? '', i18n.language)}</bdi>
                    {' · '}
                    {t('dashboard:sidebar.workingDays', {
                      count: row.workingDays,
                    })}
                  </div>
                </div>
                {/* Story 16.2: leaveTypeIcon is privacy-projected — drop the
                    element rather than render an empty decorative span. */}
                {row.leaveTypeIcon ? (
                  <span className="upcoming-icon" aria-hidden="true">
                    {row.leaveTypeIcon}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="support-note" aria-labelledby="my-leaves-clarity-title">
        <h2 id="my-leaves-clarity-title" className="support-note-title">
          {t('leaves:explainer.title')}
        </h2>
        {isLatestLoading ? (
          <LoadingState label={t('leaves:explainer.loading')} variant="block" />
        ) : latestRequest && latestContext ? (
          <>
            <p className="support-note-body" dir="auto">
              {latestContext}
            </p>
            <p
              className="support-note-body my-leaves-rail-result"
              data-testid="my-leaves-rail-working-days"
            >
              {t('leaves:history.workingDays', {
                count: latestRequest.workingDays,
              })}
            </p>
          </>
        ) : (
          <p className="support-note-body">{t('leaves:explainer.empty')}</p>
        )}
        <p className="support-note-footnote">
          {workforceGroupName
            ? t('leaves:explainer.policy', { group: isolate(workforceGroupName) })
            : t('leaves:explainer.policyFallback')}
        </p>
      </section>
    </aside>
  )
}
