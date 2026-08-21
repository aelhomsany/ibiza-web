import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { isolate } from '../../i18n/bidi'
import type {
  CalendarAbsenceResponse,
  CalendarHolidayResponse,
  CalendarMonthResponse,
  DayOfWeek,
} from '../../api/generated/types'
import { AlertDiamondIcon, SunIcon } from '../../components/ui/icons'
import { CalendarEventChip } from './CalendarEventChip'
import { CalendarMonthGrid } from './CalendarMonthGrid'
import { CalendarWeekStrip } from './CalendarWeekStrip'
import {
  absencesForDate,
  addDays,
  dateInRange,
  dayOfWeekForDate,
  formatAgendaHeading,
  formatDateRange,
  rangesOverlap,
  workingDayPosition,
} from './calendarMonthUtils'

type CalendarAgendaProps = {
  calendar: CalendarMonthResponse
  month: string
  anchorDate?: string
  weekendDays: DayOfWeek[]
  selectedDate: string | null
  onSelectedDateChange: (date: string | null) => void
  locale: string
}

type AgendaItem =
  | { kind: 'absence'; key: string; from: string; absence: CalendarAbsenceResponse }
  | { kind: 'holiday'; key: string; from: string; holiday: CalendarHolidayResponse }

type AgendaDay = {
  date: string
  // Full cards — the absences/holidays that start on this day (or, when a single
  // day is focused, everyone active that day).
  items: AgendaItem[]
  // Absences overlapping this day that started earlier — rendered as read-only
  // "still away" text so multi-day coverage surfaces without duplicating cards.
  carried: CalendarAbsenceResponse[]
}

function monthEnd(month: string): string {
  const [year, monthValue] = month.split('-').map(Number)
  const finalDay = new Date(Date.UTC(year, monthValue, 0)).getUTCDate()
  return `${month}-${String(finalDay).padStart(2, '0')}`
}

function clampToMonth(date: string, visibleFrom: string, visibleTo: string): string {
  if (date < visibleFrom) {
    return visibleFrom
  }
  if (date > visibleTo) {
    return visibleTo
  }
  return date
}

function absenceDayPosition(absence: CalendarAbsenceResponse, date: string) {
  // Position comes from the server-authoritative charged working-date list
  // (never recomputed on the client). Total prefers the stored count, falling
  // back to the list length; both stay 0 when the data is missing so the caller
  // can hide the label instead of rendering "Day 1 of 0" / "Day NaN".
  return {
    position: workingDayPosition(absence.workingDates, date),
    total: absence.workingDays ?? absence.workingDates?.length ?? 0,
  }
}

export function CalendarAgenda({
  calendar,
  month,
  anchorDate = calendar.today,
  weekendDays,
  selectedDate,
  onSelectedDateChange,
  locale,
}: CalendarAgendaProps) {
  const { t } = useTranslation('calendar')
  const visibleFrom = `${month}-01`
  const visibleTo = monthEnd(month)
  const weekAnchor = selectedDate ?? clampToMonth(anchorDate, visibleFrom, visibleTo)
  const weekendDaySet = new Set(weekendDays)
  const nameListFormatter = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' })

  const daySections = useMemo<AgendaDay[]>(() => {
    const overlappingAbsences = calendar.absences.filter((absence) =>
      rangesOverlap(absence.dateFrom, absence.dateTo, visibleFrom, visibleTo))
    const overlappingHolidays = calendar.holidays.filter((holiday) =>
      rangesOverlap(holiday.dateFrom, holiday.dateTo, visibleFrom, visibleTo))

    const startDate = (from: string) => clampToMonth(from, visibleFrom, visibleTo)
    const absenceItem = (absence: CalendarAbsenceResponse): AgendaItem => ({
      kind: 'absence',
      key: `absence-${absence.requestId}`,
      from: absence.dateFrom,
      absence,
    })
    const holidayItem = (holiday: CalendarHolidayResponse): AgendaItem => ({
      kind: 'holiday',
      key: `holiday-${holiday.holidayId}`,
      from: holiday.dateFrom,
      holiday,
    })
    const sortItems = (items: AgendaItem[]) => items.slice().sort((first, second) => (
      first.from.localeCompare(second.from) || first.key.localeCompare(second.key)
    ))

    // Focused single day: show everyone active that day as full cards.
    if (selectedDate != null) {
      const items = [
        ...overlappingAbsences
          .filter((absence) => dateInRange(selectedDate, absence.dateFrom, absence.dateTo))
          .map(absenceItem),
        ...overlappingHolidays
          .filter((holiday) => dateInRange(selectedDate, holiday.dateFrom, holiday.dateTo))
          .map(holidayItem),
      ]
      return [{ date: selectedDate, items: sortItems(items), carried: [] }]
    }

    // Unfiltered: one section per in-month day that has an absence overlapping it
    // or a holiday starting on it. Each absence/holiday card renders once on its
    // start day; days an absence only continues through list who is still away as
    // read-only text, so coverage watch + availability surface on the actually
    // understaffed days without duplicating interactive cards.
    const sections: AgendaDay[] = []
    for (let date = visibleFrom; date <= visibleTo; date = addDays(date, 1)) {
      const absencesToday = overlappingAbsences.filter((absence) =>
        dateInRange(date, absence.dateFrom, absence.dateTo))
      const startingHolidays = overlappingHolidays.filter((holiday) =>
        startDate(holiday.dateFrom) === date)
      if (absencesToday.length === 0 && startingHolidays.length === 0) {
        continue
      }
      const items = [
        ...absencesToday.filter((absence) => startDate(absence.dateFrom) === date).map(absenceItem),
        ...startingHolidays.map(holidayItem),
      ]
      const carried = absencesToday.filter((absence) => startDate(absence.dateFrom) !== date)
      sections.push({ date, items: sortItems(items), carried })
    }
    return sections
  }, [
    calendar.absences,
    calendar.holidays,
    selectedDate,
    visibleFrom,
    visibleTo,
  ])

  const renderHoliday = (
    holiday: CalendarHolidayResponse,
    key: string,
    sectionDate: string,
  ) => {
    const range = formatDateRange(holiday.dateFrom, holiday.dateTo, locale)
    const group = t('agenda.group', { name: isolate(holiday.workforceGroupName) })

    return (
      <article
        key={key}
        className="calendar-agenda-card calendar-agenda-card--holiday"
        data-testid={`calendar-holiday-${holiday.holidayId}`}
        aria-label={t('agenda.holidayAccessibleName', {
          name: holiday.name,
          group: holiday.workforceGroupName,
          range,
        })}
      >
        <span className="calendar-agenda-avatar calendar-agenda-avatar--holiday">
          <SunIcon size={20} />
        </span>
        <span className="calendar-agenda-copy">
          <span className="calendar-agenda-card-title calendar-agenda-card-title--holiday">
            {t('agenda.holidayTitle', {
              name: holiday.name,
              type: t('agenda.publicHoliday'),
            })}
          </span>
          <span className="calendar-agenda-card-subtitle">
            {t('agenda.holidaySummary', { range, group })}
          </span>
          {sectionDate !== holiday.dateFrom ? (
            <span className="calendar-agenda-progress">
              {t('agenda.holidayContinues')}
            </span>
          ) : null}
        </span>
        <span className="calendar-holiday-badge">{t('legend.holiday')}</span>
      </article>
    )
  }

  const renderAbsence = (
    absence: CalendarAbsenceResponse,
    key: string,
    sectionDate: string,
  ) => {
    const range = formatDateRange(absence.dateFrom, absence.dateTo, locale)
    const presence = t(absence.presence === 'WFH' ? 'legend.wfh' : 'legend.off')
    const accessibleName = t(
      absence.canViewRequestContext ? 'request.open' : 'request.info',
      {
        name: absence.userFullName,
        type: absence.leaveTypeName,
        presence,
        range,
      },
    )
    const workingDays = t('agenda.workingDays', { count: absence.workingDays })
    const presenceClass = absence.presence === 'WFH' ? 'badge-wfh' : 'badge-off'
    const progress = absenceDayPosition(absence, sectionDate)

    return (
      <CalendarEventChip
        key={key}
        absence={absence}
        className="calendar-agenda-card calendar-agenda-card--absence"
        testId={`calendar-event-${absence.requestId}`}
        title={`${absence.userFullName} — ${absence.leaveTypeName} (${range})`}
        accessibleName={accessibleName}
      >
        <span className="calendar-agenda-avatar">{absence.userInitials}</span>
        <span className="calendar-agenda-copy">
          <span className="calendar-agenda-card-title">
            {t('agenda.absenceTitle', {
              name: absence.userFullName,
              type: absence.leaveTypeName,
            })}
          </span>
          <span className="calendar-agenda-card-subtitle">
            {t('agenda.absenceSummary', { range, days: workingDays })}
          </span>
          <span className="calendar-agenda-meta">
            <span>{t('agenda.group', { name: isolate(absence.userWorkforceGroupName) })}</span>
            {progress.total >= 1 && progress.position >= 1 ? (
              <span className="calendar-agenda-progress">
                {t('agenda.dayProgress', progress)}
              </span>
            ) : null}
          </span>
        </span>
        <span className={`badge ${presenceClass} calendar-presence-badge`}>
          {presence}
        </span>
      </CalendarEventChip>
    )
  }

  return (
    <section className="calendar-agenda" aria-label={t('agenda.label')} data-testid="calendar-agenda">
      <div className="calendar-agenda-date-controls">
        <CalendarMonthGrid
          calendar={calendar}
          month={month}
          weekendDays={weekendDays}
          selectedDate={selectedDate}
          onSelectDate={(date) => onSelectedDateChange(date === selectedDate ? null : date)}
          locale={locale}
        />
      </div>

      <div className="calendar-agenda-list">
        <CalendarWeekStrip
          calendar={calendar}
          anchorDate={weekAnchor}
          weekendDays={weekendDays}
          selectedDate={selectedDate}
          onSelectDate={onSelectedDateChange}
          locale={locale}
        />

        <div className="calendar-agenda-heading-row">
          <h2 className="calendar-agenda-heading">
            {selectedDate == null
              ? t('agenda.thisMonth')
              : t('agenda.selectedDay')}
          </h2>
          {selectedDate != null ? (
            <button
              type="button"
              className="calendar-agenda-show-all"
              onClick={() => onSelectedDateChange(null)}
            >
              {t('agenda.showAll')}
            </button>
          ) : null}
        </div>

        {daySections.map((section) => {
          const offPeople = new Set(
            absencesForDate(section.date, calendar.absences)
              .filter((absence) => absence.presence === 'OFF')
              .map((absence) => absence.userId),
          )
          const availableCount = Math.max(0, calendar.audienceMemberCount - offPeople.size)
          const isCoverageWatch = (
            !weekendDaySet.has(dayOfWeekForDate(section.date))
            && offPeople.size >= 2
          )
          const stillAwayNames = section.carried.map((absence) => absence.userFullName)

          return (
            <section
              key={section.date}
              className="calendar-agenda-day"
              data-testid={`calendar-agenda-day-${section.date}`}
              aria-labelledby={`calendar-agenda-day-heading-${section.date}`}
            >
              <div className="calendar-agenda-day-header">
                <div>
                  <h3
                    id={`calendar-agenda-day-heading-${section.date}`}
                    className="calendar-agenda-day-heading"
                  >
                    {formatAgendaHeading(section.date, locale)}
                  </h3>
                  <p
                    className="calendar-agenda-availability"
                    data-testid={`calendar-availability-${section.date}`}
                  >
                    {calendar.audienceMemberCount > 0
                      ? t('agenda.availability', {
                          available: availableCount,
                          total: calendar.audienceMemberCount,
                        })
                      : t('agenda.availabilityUnavailable')}
                  </p>
                </div>
                {section.date === calendar.today ? (
                  <span className="calendar-agenda-today-label">{t('today')}</span>
                ) : null}
              </div>

              {isCoverageWatch ? (
                <div
                  className="calendar-agenda-coverage-watch"
                  data-testid={`calendar-coverage-watch-${section.date}`}
                  role="status"
                >
                  <AlertDiamondIcon size={18} />
                  <span>{t('agenda.coverageWatch', {
                    date: formatAgendaHeading(section.date, locale),
                    count: offPeople.size,
                  })}</span>
                </div>
              ) : null}

              <div className="calendar-agenda-day-items">
                {section.items.map((item) => (
                  item.kind === 'holiday'
                    ? renderHoliday(item.holiday, item.key, section.date)
                    : renderAbsence(item.absence, item.key, section.date)
                ))}
              </div>

              {stillAwayNames.length > 0 ? (
                <p
                  className="calendar-agenda-still-away"
                  data-testid={`calendar-still-away-${section.date}`}
                >
                  {t('agenda.stillAway', { names: nameListFormatter.format(stillAwayNames) })}
                </p>
              ) : null}

              {section.items.length === 0 && stillAwayNames.length === 0 ? (
                <div className="calendar-agenda-empty" role="status">
                  {t('agenda.emptyDay')}
                </div>
              ) : null}
            </section>
          )
        })}

        {daySections.length === 0 ? (
          <div className="calendar-agenda-empty" role="status">
            {t('agenda.emptyMonth')}
          </div>
        ) : null}
      </div>
    </section>
  )
}
