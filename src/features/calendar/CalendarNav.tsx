import { useTranslation } from 'react-i18next'
import { ChevronLeftIcon, ChevronRightIcon } from '../../components/ui/icons'

type CalendarNavProps = {
  period: 'week' | 'month'
  label: string
  onPrevious: () => void
  onNext: () => void
}

export function CalendarNav({ period, label, onPrevious, onNext }: CalendarNavProps) {
  const { t } = useTranslation('calendar')
  const isWeek = period === 'week'

  return (
    <div
      className="cal-nav calendar-glass-control"
      role="group"
      aria-label={t(isWeek ? 'navigation.week' : 'navigation.month')}
    >
      <button
        type="button"
        className="cal-nav-btn"
        data-testid={isWeek ? 'calendar-prev-week' : 'calendar-prev-month'}
        aria-label={t(isWeek ? 'navigation.previousWeek' : 'navigation.previousMonth')}
        onClick={onPrevious}
      >
        <ChevronLeftIcon size={18} />
        <span className="cal-nav-action-label">{t('navigation.previous')}</span>
      </button>
      <div
        className="cal-period"
        data-testid="calendar-month-label"
        aria-live="polite"
        aria-atomic="true"
      >
        <span data-testid="calendar-period-label">{label}</span>
      </div>
      <button
        type="button"
        className="cal-nav-btn"
        data-testid={isWeek ? 'calendar-next-week' : 'calendar-next-month'}
        aria-label={t(isWeek ? 'navigation.nextWeek' : 'navigation.nextMonth')}
        onClick={onNext}
      >
        <span className="cal-nav-action-label">{t('navigation.next')}</span>
        <ChevronRightIcon size={18} />
      </button>
    </div>
  )
}
