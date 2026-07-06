import type { CalendarMonthResponse } from '../../api/generated/types'
import { groupPillClass } from '../../components/groupPillClass'
import { CalendarEventChip } from './CalendarEventChip'
import {
  DAY_NAMES,
  absencesForDate,
  buildCalendarCells,
  formatFullDate,
  holidaysForDate,
} from './calendarMonthUtils'

type CalendarMonthGridProps = {
  calendar: CalendarMonthResponse
  month: string
}

export function CalendarMonthGrid({ calendar, month }: CalendarMonthGridProps) {
  const weekendDays = new Set(calendar.viewerWeekendDays)
  const cells = buildCalendarCells(month)

  return (
    <div className="cal-scroll" data-testid="calendar-scroll-wrap">
      <div className="card cal-card">
        <div className="cal-grid" data-testid="calendar-month-grid">
          {DAY_NAMES.map((dayName) => (
            <div key={dayName} className="cal-weekday">
              {dayName}
            </div>
          ))}

          {cells.map((cell) => {
            if (cell.kind === 'blank') {
              return <div key={cell.key} className="cal-cell blank" aria-hidden="true" />
            }

            const dayAbsences = absencesForDate(cell.date, calendar.absences)
            const dayHolidays = holidaysForDate(cell.date, calendar.holidays)
            const classNames = [
              'cal-cell',
              cell.date === calendar.today ? 'today' : '',
              weekendDays.has(cell.dayOfWeek) ? 'weekend' : '',
              dayHolidays.length > 0 ? 'holiday' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <div key={cell.date} className={classNames} data-testid={`calendar-day-${cell.date}`}>
                <div
                  className={`cal-day-num${cell.date === calendar.today ? ' today-num' : ''}`}
                >
                  <span aria-hidden="true">{cell.dayNumber}</span>
                  <span className="sr-only">{formatFullDate(cell.date)}</span>
                </div>

                {dayHolidays.map((holiday) => (
                  <div key={`${holiday.holidayId}-${cell.date}`} className="holiday-label">
                    <span>{holiday.name}</span>
                    <span className={groupPillClass(holiday.workforceGroupName)}>
                      {holiday.workforceGroupName}
                    </span>
                  </div>
                ))}

                <div className="cal-events">
                  {dayAbsences.map((absence) => (
                    <CalendarEventChip
                      key={`${absence.requestId}-${cell.date}`}
                      absence={absence}
                      date={cell.date}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
