import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarKind } from './calendarKinds'

type CalendarLegendProps = {
  /**
   * Shown only while the viewer's own pending request is on the timeline
   * (Dashboard merge, 2026-09-01) — the dashed bar needs explaining, but the
   * legend stays three items for everyone else.
   */
  showPendingOwn?: boolean
  /**
   * The one kind the timeline is filtered to, or `null` for "show everything".
   */
  activeKind?: CalendarKind | null
  /**
   * Supplied only by the view the legend can actually filter (the timeline). Without it the
   * chips stay plain spans: a control that does nothing when pressed is worse than a key.
   */
  onToggleKind?: (kind: CalendarKind) => void
}

export function CalendarLegend({
  showPendingOwn = false,
  activeKind = null,
  onToggleKind,
}: CalendarLegendProps) {
  const { t } = useTranslation('calendar')
  const interactive = onToggleKind != null

  const entry = (kind: CalendarKind, swatch: ReactNode, label: string) => {
    const pressed = activeKind === kind
    // `cal-legend-pending-own` predates the filter and is asserted by TeamCalendarPage.test;
    // the other three ids are new, so they take the plain form.
    const testId = kind === 'PENDING' ? 'cal-legend-pending-own' : `cal-legend-${kind.toLowerCase()}`
    const className = [
      'cal-legend-item',
      interactive ? 'cal-legend-item--button' : '',
      pressed ? 'is-active' : '',
    ]
      .filter(Boolean)
      .join(' ')

    if (!interactive) {
      return (
        <span className={className} data-testid={testId}>
          {swatch}
          <span>{label}</span>
        </span>
      )
    }

    return (
      <button
        type="button"
        className={className}
        data-testid={testId}
        aria-pressed={pressed}
        onClick={() => onToggleKind(kind)}
      >
        {swatch}
        <span>{label}</span>
      </button>
    )
  }

  return (
    <div
      className="cal-legend"
      role={interactive ? 'group' : undefined}
      aria-label={interactive ? t('legend.filterLabel') : t('legend.label')}
    >
      {entry(
        'OFF',
        <span className="cal-legend-presence cal-legend-presence--off" aria-hidden="true">
          AA
        </span>,
        t('legend.off'),
      )}
      {entry(
        'WFH',
        <span className="cal-legend-presence cal-legend-presence--wfh" aria-hidden="true">
          AA
        </span>,
        t('legend.wfh'),
      )}
      {entry(
        'HOLIDAY',
        <span className="cal-holiday-swatch" aria-hidden="true" />,
        t('legend.holiday'),
      )}
      {showPendingOwn
        ? entry(
            'PENDING',
            <span className="cal-legend-presence cal-legend-presence--pending" aria-hidden="true">
              AA
            </span>,
            t('legend.pendingOwn'),
          )
        : null}
    </div>
  )
}
