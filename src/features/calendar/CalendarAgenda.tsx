import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  CalendarAbsenceResponse,
  CalendarHolidayResponse,
  CalendarMonthResponse,
  DayOfWeek,
} from '../../api/generated/types'
import { SunIcon } from '../../components/ui/icons'
import { CalendarEventChip } from './CalendarEventChip'
import { CalendarMonthGrid } from './CalendarMonthGrid'
import {
  dateInRange,
  formatAgendaHeading,
  formatDateRange,
  rangesOverlap,
} from './calendarMonthUtils'

type CalendarAgendaProps = {
  calendar: CalendarMonthResponse
  month: string
  weekendDays: DayOfWeek[]
  selectedDate: string | null
  onSelectedDateChange: (date: string | null) => void
  locale: string
}

type AgendaItem =
  | {
      kind: 'absence'
      key: string
      sortDate: string
      dateFrom: string
      dateTo: string
      absence: CalendarAbsenceResponse
    }
  | {
      kind: 'holiday'
      key: string
      sortDate: string
      dateFrom: string
      dateTo: string
      holiday: CalendarHolidayResponse
    }

function monthEnd(month: string): string {
  const [year, monthValue] = month.split('-').map(Number)
  const finalDay = new Date(Date.UTC(year, monthValue, 0)).getUTCDate()
  return `${month}-${String(finalDay).padStart(2, '0')}`
}

export function CalendarAgenda({
  calendar,
  month,
  weekendDays,
  selectedDate,
  onSelectedDateChange,
  locale,
}: CalendarAgendaProps) {
  const { t } = useTranslation('calendar')
  const items = useMemo(() => {
    const visibleFrom = `${month}-01`
    const visibleTo = monthEnd(month)
    const absences: AgendaItem[] = calendar.absences
      .filter((absence) => rangesOverlap(absence.dateFrom, absence.dateTo, visibleFrom, visibleTo))
      .map((absence) => ({
        kind: 'absence',
        key: `absence-${absence.requestId}`,
        sortDate: absence.dateFrom,
        dateFrom: absence.dateFrom,
        dateTo: absence.dateTo,
        absence,
      }))
    const holidays: AgendaItem[] = calendar.holidays
      .filter((holiday) => rangesOverlap(holiday.dateFrom, holiday.dateTo, visibleFrom, visibleTo))
      .map((holiday) => ({
        kind: 'holiday',
        key: `holiday-${holiday.holidayId}`,
        sortDate: holiday.dateFrom,
        dateFrom: holiday.dateFrom,
        dateTo: holiday.dateTo,
        holiday,
      }))

    return [...absences, ...holidays].sort((first, second) => (
      first.sortDate.localeCompare(second.sortDate) || first.key.localeCompare(second.key)
    ))
  }, [calendar.absences, calendar.holidays, month])

  const visibleItems = selectedDate == null
    ? items
    : items.filter((item) => dateInRange(selectedDate, item.dateFrom, item.dateTo))

  return (
    <section className="calendar-agenda" aria-label={t('agenda.label')} data-testid="calendar-agenda">
      <CalendarMonthGrid
        calendar={calendar}
        month={month}
        weekendDays={weekendDays}
        selectedDate={selectedDate}
        onSelectDate={(date) => onSelectedDateChange(date === selectedDate ? null : date)}
        locale={locale}
      />

      <div className="calendar-agenda-list">
        <div className="calendar-agenda-heading-row">
          <h2 className="calendar-agenda-heading">
            {selectedDate == null
              ? t('agenda.thisMonth')
              : formatAgendaHeading(selectedDate, locale)}
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

        {visibleItems.map((item) => {
          if (item.kind === 'holiday') {
            const range = formatDateRange(item.holiday.dateFrom, item.holiday.dateTo, locale)
            const group = t('agenda.group', { name: item.holiday.workforceGroupName })
            return (
              <article
                key={item.key}
                className="calendar-agenda-card calendar-agenda-card--holiday"
                data-testid={`calendar-holiday-${item.holiday.holidayId}`}
              >
                <span className="calendar-agenda-avatar calendar-agenda-avatar--holiday">
                  <SunIcon size={20} />
                </span>
                <span className="calendar-agenda-copy">
                  <span className="calendar-agenda-card-title calendar-agenda-card-title--holiday">
                    {t('agenda.holidayTitle', {
                      name: item.holiday.name,
                      type: t('agenda.publicHoliday'),
                    })}
                  </span>
                  <span className="calendar-agenda-card-subtitle">
                    {t('agenda.holidaySummary', { range, group })}
                  </span>
                </span>
                <span className="calendar-holiday-badge">{t('legend.holiday')}</span>
              </article>
            )
          }

          const { absence } = item
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

          return (
            <CalendarEventChip
              key={item.key}
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
              </span>
              <span className={`badge ${presenceClass} calendar-presence-badge`}>
                {presence}
              </span>
            </CalendarEventChip>
          )
        })}

        {visibleItems.length === 0 ? (
          <div className="calendar-agenda-empty" role="status">
            {t(selectedDate == null ? 'agenda.emptyMonth' : 'agenda.emptyDay')}
          </div>
        ) : null}
      </div>
    </section>
  )
}
