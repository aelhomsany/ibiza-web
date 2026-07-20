import { useTranslation } from 'react-i18next'

export function CalendarLegend() {
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
    </div>
  )
}
