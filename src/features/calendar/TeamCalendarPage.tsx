import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ApiError, getWorkforceGroups } from '../../api/client'
import { CloseIcon } from '../../components/ui/icons'
import { CalendarLegend } from './CalendarLegend'
import { CalendarMonthGrid } from './CalendarMonthGrid'
import { CalendarNav } from './CalendarNav'
import { yearMonthFromDate } from './calendarMonthUtils'
import { useCalendarMonth } from './useCalendarMonth'
import './calendar.css'

// Bootstrap guess only — the authoritative month is reconciled from the server `today`
// (viewer IANA timezone, AC1/AC4) once the first response lands. Use the viewer's LOCAL
// calendar month rather than UTC (`toISOString`) so the first request matches the
// server-derived month in the common case and avoids a wrong-month flash + double fetch
// at month boundaries for timezones offset from UTC.
function currentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem.detail ?? error.problem.title ?? 'Unable to load the team calendar.'
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Unable to load the team calendar.'
}

export function TeamCalendarPage() {
  const [month, setMonth] = useState(currentYearMonth)
  const [workforceGroupId, setWorkforceGroupId] = useState<number | undefined>(undefined)
  const initializedFromServerToday = useRef(false)
  const calendarQuery = useCalendarMonth(month, workforceGroupId)
  const workforceGroupsQuery = useQuery({
    queryKey: ['workforce-groups', 'calendar-filter'],
    queryFn: getWorkforceGroups,
  })

  useEffect(() => {
    if (!calendarQuery.data || initializedFromServerToday.current) {
      return undefined
    }

    initializedFromServerToday.current = true
    const serverMonth = yearMonthFromDate(calendarQuery.data.today)
    if (serverMonth !== month) {
      const timer = window.setTimeout(() => setMonth(serverMonth), 0)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [calendarQuery.data, month])

  const displayMonth = calendarQuery.data?.month ?? month
  const filterId = 'calendar-workforce-group-filter'

  return (
    <div className="page page-wide" data-testid="team-calendar-page">
      <header className="page-header calendar-page-header">
        <div>
          <h1 className="page-title">Team Calendar</h1>
          <p className="page-sub">Org-wide leave coverage and holidays</p>
        </div>
        <div className="calendar-header-actions">
          <div className="calendar-filter">
            <label htmlFor={filterId}>Workforce Group</label>
            <select
              id={filterId}
              className="calendar-filter-select"
              value={workforceGroupId ?? ''}
              onChange={(event) => {
                const nextValue = event.target.value
                setWorkforceGroupId(nextValue === '' ? undefined : Number(nextValue))
              }}
              aria-invalid={workforceGroupsQuery.isError ? true : undefined}
            >
              <option value="">All Groups</option>
              {workforceGroupsQuery.data?.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          {workforceGroupId != null && (
            <button
              type="button"
              className="calendar-filter-clear"
              onClick={() => setWorkforceGroupId(undefined)}
              aria-label="Clear Workforce Group filter"
            >
              <CloseIcon size={16} />
            </button>
          )}
          <CalendarNav month={displayMonth} onMonthChange={setMonth} />
        </div>
      </header>

      {workforceGroupsQuery.isError && (
        <p className="calendar-filter-error" role="status">
          Workforce Group options could not be loaded.
        </p>
      )}

      {calendarQuery.isPending && (
        <div className="card cal-card" data-testid="team-calendar-loading" aria-busy="true">
          <span className="sr-only">Loading team calendar</span>
          <div className="cal-grid cal-grid-skeleton" aria-hidden="true">
            {Array.from({ length: 35 }).map((_, index) => (
              <div key={index} className="cal-cell cal-cell-skeleton" />
            ))}
          </div>
        </div>
      )}

      {calendarQuery.isError && (
        <div className="calendar-state card calendar-error" data-testid="team-calendar-error">
          {errorMessage(calendarQuery.error)}
        </div>
      )}

      {calendarQuery.isSuccess && (
        <section className="calendar-section" aria-label="Team calendar month">
          <CalendarLegend
            absences={calendarQuery.data.absences}
            holidays={calendarQuery.data.holidays}
          />
          <CalendarMonthGrid calendar={calendarQuery.data} month={displayMonth} />
        </section>
      )}
    </div>
  )
}
