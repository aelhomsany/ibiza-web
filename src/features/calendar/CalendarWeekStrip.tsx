import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarMonthResponse, DayOfWeek } from '../../api/generated/types'
import {
  absencesForDate,
  buildWeekDates,
  formatDayNumber,
  formatFullDate,
  formatWeekStripWeekday,
  holidaysForDate,
  startOfWeek,
} from './calendarMonthUtils'

type CalendarWeekStripProps = {
  calendar: CalendarMonthResponse
  anchorDate: string
  weekendDays: DayOfWeek[]
  selectedDate: string | null
  onSelectDate: (date: string) => void
  locale: string
}

export function CalendarWeekStrip({
  calendar,
  anchorDate,
  weekendDays,
  selectedDate,
  onSelectDate,
  locale,
}: CalendarWeekStripProps) {
  const { t } = useTranslation('calendar')
  const dates = useMemo(
    () => buildWeekDates(startOfWeek(anchorDate, weekendDays)),
    [anchorDate, weekendDays],
  )

  return (
    <div
      className="calendar-week-strip calendar-glass-card"
      data-testid="calendar-week-strip"
      role="group"
      aria-label={t('agenda.weekStripLabel')}
    >
      {dates.map((date) => {
        const absenceCount = absencesForDate(date, calendar.absences).length
        const holidayCount = holidaysForDate(date, calendar.holidays).length
        const isSelected = date === selectedDate
        const isToday = date === calendar.today

        return (
          <button
            key={date}
            type="button"
            className={[
              'calendar-week-day',
              isSelected ? 'selected' : '',
              isToday ? 'today' : '',
            ].filter(Boolean).join(' ')}
            data-testid={`calendar-week-day-${date}`}
            aria-label={t('agenda.weekDayLabel', {
              date: formatFullDate(date, locale),
              absenceCount,
              holidayCount,
            })}
            aria-pressed={isSelected}
            aria-current={isToday ? 'date' : undefined}
            onClick={() => onSelectDate(date)}
          >
            <span className="calendar-week-day-name" aria-hidden="true">
              {formatWeekStripWeekday(date, locale)}
            </span>
            <span className="calendar-week-day-number" aria-hidden="true">
              {formatDayNumber(date, locale)}
            </span>
            {absenceCount > 0 || holidayCount > 0 ? (
              <span className="calendar-week-day-marker" aria-hidden="true" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
