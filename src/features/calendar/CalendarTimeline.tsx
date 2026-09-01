import type { CSSProperties, KeyboardEvent } from 'react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  CalendarAbsenceResponse,
  CalendarMonthResponse,
  DayOfWeek,
} from '../../api/generated/types'
import { AlertDiamondIcon } from '../../components/ui/icons'
import { chipColorStyle } from '../../utils/entityColor'
import { CalendarEventChip } from './CalendarEventChip'
import type { CalendarKind } from './calendarKinds'
import { isKindVisible, kindOfAbsence } from './calendarKinds'
import {
  absencesForDate,
  buildWeekDates,
  dayOfWeekForDate,
  formatDateRange,
  formatFullDate,
  formatTimelineDay,
  holidaysForDate,
  rangesOverlap,
  uniqueBy,
} from './calendarMonthUtils'

/**
 * The viewer's own pending request, synthesized by TeamCalendarPage from the
 * self-scoped /leave-requests response (the calendar feed itself is
 * approved-only). Rendered as a dashed outline bar; excluded from the
 * coverage alert, which speaks only for approved absences.
 */
export type PendingOwnAbsence = CalendarAbsenceResponse & { pending: true }

type TimelineAbsence = CalendarAbsenceResponse & { pending?: boolean }

type CalendarTimelineProps = {
  calendar: CalendarMonthResponse
  pendingOwnAbsences?: PendingOwnAbsence[]
  weekStart: string
  weekendDays: DayOfWeek[]
  locale: string
  focusedDate?: string | null
  onFocusedDateChange?: (date: string) => void
  /** The one legend chip that is lit, or `null` while the timeline shows every kind. */
  activeKind?: CalendarKind | null
  onClearKindFilter?: () => void
}

type PositionedAbsence = {
  absence: TimelineAbsence
  startIndex: number
  endIndex: number
  lane: number
}

function positionAbsences(
  absences: TimelineAbsence[],
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
  pendingOwnAbsences = [],
  weekStart,
  weekendDays,
  locale,
  focusedDate = null,
  onFocusedDateChange,
  activeKind = null,
  onClearKindFilter,
}: CalendarTimelineProps) {
  const { t, i18n } = useTranslation('calendar')
  const [announcedDate, setAnnouncedDate] = useState('')
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
  const weekPendingOwn = pendingOwnAbsences.filter((absence) => (
    rangesOverlap(absence.dateFrom, absence.dateTo, weekStart, weekEnd)
  ))
  // Approved bars plus the viewer's own pending overlay, minus whatever the legend filter
  // switched off. Coverage below stays on the UNFILTERED `weekAbsences`: an unapproved request
  // must not raise the alert, and a reader who has narrowed the view to WFH must not be told
  // the week is covered. The alert is a fact about the week, not about the current filter.
  const weekDisplayAbsences: TimelineAbsence[] = [
    ...weekAbsences,
    ...weekPendingOwn,
  ].filter((absence) => isKindVisible(kindOfAbsence(absence), activeKind))
  const showHolidays = isKindVisible('HOLIDAY', activeKind)
  const holidayIndexes = showHolidays
    ? weekDates.reduce<number[]>((indexes, date, index) => (
        holidaysForDate(date, calendar.holidays).length > 0 ? [...indexes, index] : indexes
      ), [])
    : []
  // Story 16.2: identity is projected, so sort on the displayed label rather than assuming a
  // name is present. Redacted rows collate together under the fallback label.
  const displayName = (absence: { userFullName?: string }) =>
    absence.userFullName ?? t('redacted.person')
  // Story 16.2 / code review 2026-08-29: identity and Leave Type are privacy-projected and may
  // be absent. Under the D-14 defaults they ARE absent for every same-group and organization
  // peer, so these are the ordinary rendering path on the default calendar view, not an edge
  // case. Template literals interpolate `undefined` happily and TypeScript will not stop them.
  const leaveTypeLabel = (absence: { leaveTypeName?: string }) =>
    absence.leaveTypeName ?? t('redacted.leaveType')
  const groupLabel = (person: { userWorkforceGroupName?: string }) =>
    person.userWorkforceGroupName ?? t('redacted.group')
  const people = uniqueBy(weekDisplayAbsences, (absence) => absence.userId)
    .sort((first, second) => displayName(first).localeCompare(displayName(second), locale))
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
  const rovingDate = focusedDate != null && weekDates.includes(focusedDate)
    ? focusedDate
    : weekDates[0]

  const focusDate = (date: string) => {
    document.getElementById(`calendar-timeline-date-${date}`)?.focus()
    onFocusedDateChange?.(date)
    setAnnouncedDate(formatFullDate(date, locale))
  }

  const handleDateKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null
    const isRtl = i18n.dir() === 'rtl'

    if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = weekDates.length - 1
    } else if (event.key === 'ArrowRight') {
      nextIndex = index + (isRtl ? -1 : 1)
    } else if (event.key === 'ArrowLeft') {
      nextIndex = index + (isRtl ? 1 : -1)
    }

    if (nextIndex == null || nextIndex < 0 || nextIndex >= weekDates.length) {
      return
    }

    event.preventDefault()
    focusDate(weekDates[nextIndex])
  }

  return (
    <section aria-label={t('timeline.label')} data-testid="calendar-timeline">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcedDate}
      </p>
      <div className="cal-scroll" data-testid="calendar-scroll-wrap">
        <div className="calendar-timeline-card calendar-glass-card">
          <div className="calendar-timeline-grid calendar-timeline-header">
            {holidayIndexes.map((index) => (
              <span
                key={`holiday-header-${index}`}
                className="calendar-holiday-column calendar-holiday-column--header"
                style={{ gridColumn: index + 2 }}
                data-testid={`calendar-holiday-column-${weekDates[index]}`}
                aria-hidden="true"
              />
            ))}
            {todayIndex >= 0 ? (
              <span
                className="calendar-today-column calendar-today-column--header"
                style={{ gridColumn: todayIndex + 2 }}
                aria-hidden="true"
              />
            ) : null}
            <span className="calendar-timeline-person-heading">{t('timeline.person')}</span>
            {weekDates.map((date, index) => {
              const holidays = showHolidays ? holidaysForDate(date, calendar.holidays) : []
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
                <button
                  key={date}
                  id={`calendar-timeline-date-${date}`}
                  type="button"
                  className={className}
                  style={{ gridColumn: index + 2 }}
                  data-testid={`calendar-timeline-date-${date}`}
                  aria-label={holidayNames ? `${dayLabel}, ${holidayNames}` : dayLabel}
                  aria-current={isToday ? 'date' : undefined}
                  tabIndex={date === rovingDate ? 0 : -1}
                  onFocus={() => onFocusedDateChange?.(date)}
                  onKeyDown={(event) => handleDateKeyDown(event, index)}
                >
                  <span>{dayLabel}</span>
                </button>
              )
            })}
          </div>

          {people.length > 0 ? (
            <div className="calendar-timeline-rows">
              {people.map((person) => {
                const positionedAbsences = positionAbsences(
                  weekDisplayAbsences.filter((absence) => absence.userId === person.userId),
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
                    {holidayIndexes.map((index) => (
                      <span
                        key={`holiday-${index}`}
                        className="calendar-holiday-column"
                        style={{
                          gridColumn: index + 2,
                          gridRow: `1 / span ${laneCount}`,
                        }}
                        aria-hidden="true"
                      />
                    ))}
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
                        {person.userInitials ?? '?'}
                      </span>
                      <span className="calendar-person-copy">
                        <span className="calendar-person-name" dir="auto">{displayName(person)}</span>
                        <span className="calendar-person-group" dir="auto">
                          {groupLabel(person)}
                        </span>
                      </span>
                    </span>

                    {positionedAbsences.map(({ absence, startIndex, endIndex, lane }) => {
                      const span = endIndex - startIndex + 1
                      const range = formatDateRange(absence.dateFrom, absence.dateTo, locale)
                      const label = span >= 2
                        ? t('timeline.bar', {
                            type: leaveTypeLabel(absence),
                            count: absence.workingDays,
                          })
                        : t('timeline.barShort', { count: absence.workingDays })
                      const presence = t(
                        absence.presence === 'WFH' ? 'legend.wfh' : 'legend.off',
                      )
                      const accessibleName = absence.pending
                        ? t('request.pendingOpen', {
                            type: leaveTypeLabel(absence),
                            range,
                          })
                        : t(
                            absence.canViewRequestContext ? 'request.open' : 'request.info',
                            {
                              name: displayName(absence),
                              type: leaveTypeLabel(absence),
                              presence,
                              range,
                            },
                          )

                      return (
                        <CalendarEventChip
                          key={absence.requestId}
                          absence={absence}
                          className={
                            absence.pending
                              ? 'calendar-timeline-bar calendar-timeline-bar--pending'
                              : 'calendar-timeline-bar'
                          }
                          testId={`calendar-event-${absence.requestId}`}
                          title={`${displayName(absence)} — ${leaveTypeLabel(absence)} (${range})`}
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
          ) : activeKind != null ? (
            /* The week may be full of absences and still show nothing: the reader narrowed the
               view. Saying "full coverage" here would be a lie, so the filtered case gets its
               own message and a way back out. */
            <div
              className="calendar-timeline-empty calendar-timeline-empty--filtered"
              role="status"
              data-testid="calendar-timeline-empty-filtered"
            >
              <span>{t('timeline.emptyFiltered')}</span>
              {onClearKindFilter ? (
                <button
                  type="button"
                  className="btn btn-secondary calendar-timeline-clear-filter"
                  onClick={onClearKindFilter}
                >
                  {t('timeline.clearFilter')}
                </button>
              ) : null}
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
