import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  CalendarAbsenceResponse,
  CalendarMonthResponse,
  DayOfWeek,
} from '../../api/generated/types'
import { AlertDiamondIcon } from '../../components/ui/icons'
import { chipColorStyle } from '../../utils/entityColor'
import { CalendarEventChip } from './CalendarEventChip'
import {
  absencesForDate,
  buildWeekDates,
  dayOfWeekForDate,
  formatDateRange,
  formatTimelineDay,
  holidaysForDate,
  rangesOverlap,
  uniqueBy,
} from './calendarMonthUtils'

type CalendarTimelineProps = {
  calendar: CalendarMonthResponse
  weekStart: string
  weekendDays: DayOfWeek[]
  locale: string
}

type PositionedAbsence = {
  absence: CalendarAbsenceResponse
  startIndex: number
  endIndex: number
  lane: number
}

function positionAbsences(
  absences: CalendarAbsenceResponse[],
  weekDates: string[],
): PositionedAbsence[] {
  const visibleAbsences = absences
    // Malformed/reversed API data (dateFrom > dateTo) would otherwise produce
    // a negative grid-column span below; skip it rather than render garbage.
    .filter((absence) => absence.dateFrom <= absence.dateTo)
    .map((absence) => ({
      absence,
      startIndex: weekDates.findIndex((date) => date >= absence.dateFrom),
      endIndex: weekDates.findLastIndex((date) => date <= absence.dateTo),
    }))
    .filter(({ startIndex, endIndex }) => startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex)
    .sort((first, second) => (
      first.startIndex - second.startIndex
      || first.endIndex - second.endIndex
      || first.absence.requestId - second.absence.requestId
    ))
  const laneEnds: number[] = []

  return visibleAbsences.map((visibleAbsence) => {
    const availableLane = laneEnds.findIndex(
      (laneEnd) => laneEnd < visibleAbsence.startIndex,
    )
    const lane = availableLane === -1 ? laneEnds.length : availableLane
    laneEnds[lane] = visibleAbsence.endIndex
    return { ...visibleAbsence, lane }
  })
}

export function CalendarTimeline({
  calendar,
  weekStart,
  weekendDays,
  locale,
}: CalendarTimelineProps) {
  const { t } = useTranslation('calendar')
  const weekDates = useMemo(() => buildWeekDates(weekStart), [weekStart])
  const listFormatter = useMemo(
    () => new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }),
    [locale],
  )
  const weekEnd = weekDates[6]
  const weekendDaySet = new Set(weekendDays)
  const weekAbsences = calendar.absences.filter((absence) => (
    rangesOverlap(absence.dateFrom, absence.dateTo, weekStart, weekEnd)
  ))
  const people = uniqueBy(weekAbsences, (absence) => absence.userId)
    .sort((first, second) => first.userFullName.localeCompare(second.userFullName, locale))
  const todayIndex = weekDates.indexOf(calendar.today)
  const coverageDays = weekDates.filter((date) => {
    if (weekendDaySet.has(dayOfWeekForDate(date))) {
      return false
    }

    const awayPeople = new Set(
      absencesForDate(date, weekAbsences)
        .filter((absence) => absence.presence === 'OFF')
        .map((absence) => absence.userId),
    )
    return awayPeople.size >= 2
  })
  const coverageLabels = listFormatter.format(
    coverageDays.map((date) => formatTimelineDay(date, locale)),
  )

  return (
    <section aria-label={t('timeline.label')} data-testid="calendar-timeline">
      <div className="cal-scroll" data-testid="calendar-scroll-wrap">
        <div className="calendar-timeline-card calendar-glass-card">
          <div className="calendar-timeline-grid calendar-timeline-header">
            {todayIndex >= 0 ? (
              <span
                className="calendar-today-column calendar-today-column--header"
                style={{ gridColumn: todayIndex + 2 }}
                aria-hidden="true"
              />
            ) : null}
            <span className="calendar-timeline-person-heading">{t('timeline.person')}</span>
            {weekDates.map((date, index) => {
              const holidays = holidaysForDate(date, calendar.holidays)
              const isToday = date === calendar.today
              const calendarDay = dayOfWeekForDate(date)
              const className = [
                'calendar-timeline-day',
                isToday ? 'today' : '',
                weekendDaySet.has(calendarDay) ? 'weekend' : '',
                holidays.length > 0 ? 'holiday' : '',
              ]
                .filter(Boolean)
                .join(' ')
              const dayLabel = formatTimelineDay(date, locale)
              const holidayNames = listFormatter.format(holidays.map((holiday) => holiday.name))

              return (
                <span
                  key={date}
                  className={className}
                  style={{ gridColumn: index + 2 }}
                  aria-label={holidayNames ? `${dayLabel}, ${holidayNames}` : dayLabel}
                  aria-current={isToday ? 'date' : undefined}
                >
                  <span>{dayLabel}</span>
                </span>
              )
            })}
          </div>

          {people.length > 0 ? (
            <div className="calendar-timeline-rows">
              {people.map((person) => {
                const positionedAbsences = positionAbsences(
                  weekAbsences.filter((absence) => absence.userId === person.userId),
                  weekDates,
                )
                const laneCount = Math.max(
                  1,
                  ...positionedAbsences.map(({ lane }) => lane + 1),
                )
                const colorStyle = chipColorStyle(person.userId) as CSSProperties

                return (
                  <div
                    key={person.userId}
                    className="calendar-timeline-grid calendar-timeline-row"
                    data-testid={`calendar-person-${person.userId}`}
                    style={{ gridTemplateRows: `repeat(${laneCount}, 32px)` }}
                  >
                    {todayIndex >= 0 ? (
                      <span
                        className="calendar-today-column"
                        style={{
                          gridColumn: todayIndex + 2,
                          gridRow: `1 / span ${laneCount}`,
                        }}
                        aria-hidden="true"
                      />
                    ) : null}
                    <span
                      className="calendar-timeline-person"
                      style={{ gridRow: `1 / span ${laneCount}` }}
                    >
                      <span className="calendar-person-avatar" style={colorStyle}>
                        {person.userInitials}
                      </span>
                      <span className="calendar-person-name">{person.userFullName}</span>
                    </span>

                    {positionedAbsences.map(({ absence, startIndex, endIndex, lane }) => {
                      const span = endIndex - startIndex + 1
                      const range = formatDateRange(absence.dateFrom, absence.dateTo, locale)
                      const label = span >= 2
                        ? t('timeline.bar', {
                            type: absence.leaveTypeName,
                            count: absence.workingDays,
                          })
                        : t('timeline.barShort', { count: absence.workingDays })
                      const presence = t(
                        absence.presence === 'WFH' ? 'legend.wfh' : 'legend.off',
                      )
                      const accessibleName = t(
                        absence.canViewRequestContext ? 'request.open' : 'request.info',
                        {
                          name: absence.userFullName,
                          type: absence.leaveTypeName,
                          presence,
                          range,
                        },
                      )

                      return (
                        <CalendarEventChip
                          key={absence.requestId}
                          absence={absence}
                          className="calendar-timeline-bar"
                          testId={`calendar-event-${absence.requestId}`}
                          title={`${absence.userFullName} — ${absence.leaveTypeName} (${range})`}
                          accessibleName={accessibleName}
                          style={{
                            gridColumn: `${startIndex + 2} / span ${span}`,
                            gridRow: lane + 1,
                          }}
                        >
                          {label}
                        </CalendarEventChip>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="calendar-timeline-empty" role="status">
              {t('timeline.empty')}
            </div>
          )}

          {coverageDays.length > 0 ? (
            <div className="calendar-coverage-alert" role="status" data-testid="calendar-coverage-alert">
              <AlertDiamondIcon size={18} />
              <span>{t('timeline.coverage', { count: coverageDays.length, days: coverageLabels })}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
