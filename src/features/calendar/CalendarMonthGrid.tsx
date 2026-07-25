import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarMonthResponse, DayOfWeek } from '../../api/generated/types'
import { chipColorStyle } from '../../utils/entityColor'
import {
  absencesForDate,
  buildCalendarCells,
  formatMonthDay,
  formatWeekdayLetters,
  formatYearMonthLabel,
  holidaysForDate,
} from './calendarMonthUtils'

type CalendarMonthGridProps = {
  calendar: CalendarMonthResponse
  month: string
  weekendDays?: DayOfWeek[]
  selectedDate?: string | null
  onSelectDate?: (date: string) => void
  locale?: string
}

export function CalendarMonthGrid({
  calendar,
  month,
  weekendDays = calendar.viewerWeekendDays,
  selectedDate = null,
  onSelectDate,
  locale = 'en-US',
}: CalendarMonthGridProps) {
  const { t } = useTranslation('calendar')
  const weekendDaySet = new Set(weekendDays)
  const cells = buildCalendarCells(month)
  const weekdayLetters = formatWeekdayLetters(locale)
  const listFormatter = useMemo(
    () => new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }),
    [locale],
  )

  return (
    <div className="calendar-mini calendar-glass-card" data-testid="calendar-mini-month">
      <h2 id="calendar-mini-title" className="calendar-mini-title">
        {formatYearMonthLabel(month, locale)}
      </h2>
      <div
        className="calendar-mini-grid"
        data-testid="calendar-month-grid"
        role="group"
        aria-labelledby="calendar-mini-title"
      >
        {weekdayLetters.map((letter, index) => (
          <span key={`${letter}-${index}`} className="calendar-mini-weekday" aria-hidden="true">
            {letter}
          </span>
        ))}

        {cells.map((cell) => {
          if (cell.kind === 'blank') {
            return <span key={cell.key} className="calendar-mini-day-blank" aria-hidden="true" />
          }

          const dayAbsences = absencesForDate(cell.date, calendar.absences)
          const dayHolidays = holidaysForDate(cell.date, calendar.holidays)
          const isToday = cell.date === calendar.today
          const isSelected = cell.date === selectedDate
          const className = [
            'calendar-mini-day',
            isToday ? 'today' : '',
            isSelected ? 'selected' : '',
            weekendDaySet.has(cell.dayOfWeek) ? 'weekend' : '',
            dayHolidays.length > 0 ? 'holiday' : '',
          ]
            .filter(Boolean)
            .join(' ')
          const absenceLabel = t('agenda.dayLabel', {
            date: formatMonthDay(cell.date, locale),
            count: dayAbsences.length,
          })
          const holidayNames = listFormatter.format(dayHolidays.map((holiday) => holiday.name))
          const accessibleName = holidayNames
            ? `${absenceLabel}, ${holidayNames}`
            : absenceLabel
          const colorStyle = dayAbsences.length > 0
            ? chipColorStyle(dayAbsences[0].userId) as CSSProperties
            : undefined

          return (
            <button
              key={cell.date}
              type="button"
              className={className}
              data-testid={`calendar-day-${cell.date}`}
              aria-label={accessibleName}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={isSelected}
              style={colorStyle}
              onClick={() => onSelectDate?.(cell.date)}
            >
              <span aria-hidden="true">{cell.dayNumber}</span>
              {dayAbsences.length > 0 ? (
                <span className="calendar-mini-absence-dot" aria-hidden="true" />
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="calendar-mini-legend" aria-label={t('legend.label')}>
        <span>
          <span className="calendar-mini-legend-dot calendar-mini-legend-dot--leave" />
          {t('legend.leave')}
        </span>
        <span>
          <span className="calendar-mini-legend-dot calendar-mini-legend-dot--holiday" />
          {t('legend.holiday')}
        </span>
      </div>
    </div>
  )
}
