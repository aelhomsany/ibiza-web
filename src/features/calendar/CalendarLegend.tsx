import { useTranslation } from 'react-i18next'

type CalendarLegendProps = {
  /**
   * Shown only while the viewer's own pending request is on the timeline
   * (Dashboard merge, 2026-09-01) — the dashed bar needs explaining, but the
   * legend stays three items for everyone else.
   */
  showPendingOwn?: boolean
}

export function CalendarLegend({ showPendingOwn = false }: CalendarLegendProps) {
  const { t } = useTranslation('calendar')

  return (
    <div className="cal-legend" aria-label={t('legend.label')}>
      <span className="cal-legend-item">
        <span className="cal-legend-presence cal-legend-presence--off" aria-hidden="true">
          AA
        </span>
        <span>{t('legend.off')}</span>
      </span>
      <span className="cal-legend-item">
        <span className="cal-legend-presence cal-legend-presence--wfh" aria-hidden="true">
          AA
        </span>
        <span>{t('legend.wfh')}</span>
      </span>
      <span className="cal-legend-item">
        <span className="cal-holiday-swatch" aria-hidden="true" />
        <span>{t('legend.holiday')}</span>
      </span>
      {showPendingOwn ? (
        <span className="cal-legend-item" data-testid="cal-legend-pending-own">
          <span className="cal-legend-presence cal-legend-presence--pending" aria-hidden="true">
            AA
          </span>
          <span>{t('legend.pendingOwn')}</span>
        </span>
      ) : null}
    </div>
  )
}
