import { addMonths, formatYearMonthLabel } from './calendarMonthUtils'

type CalendarNavProps = {
  month: string
  onMonthChange: (month: string) => void
}

export function CalendarNav({ month, onMonthChange }: CalendarNavProps) {
  return (
    <div className="cal-nav" aria-label="Calendar month navigation">
      <button
        type="button"
        className="cal-nav-btn"
        data-testid="calendar-prev-month"
        aria-label="Previous month"
        onClick={() => onMonthChange(addMonths(month, -1))}
      >
        ‹
      </button>
      <div className="cal-month" data-testid="calendar-month-label">
        {formatYearMonthLabel(month)}
      </div>
      <button
        type="button"
        className="cal-nav-btn"
        data-testid="calendar-next-month"
        aria-label="Next month"
        onClick={() => onMonthChange(addMonths(month, 1))}
      >
        ›
      </button>
    </div>
  )
}
