import { render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { MemoryRouter } from 'react-router-dom'
import type { CalendarMonthResponse } from '../../api/generated/types'
import arCalendar from '../../i18n/locales/ar/calendar.json'
import { CalendarTimeline } from './CalendarTimeline'
import { mockCalendarMonth } from './calendarTestFixtures'

function renderTimeline(
  calendar: CalendarMonthResponse = mockCalendarMonth,
  weekStart = '2026-06-07',
) {
  return render(
    <MemoryRouter>
      <CalendarTimeline
        calendar={calendar}
        weekStart={weekStart}
        weekendDays={calendar.viewerWeekendDays}
        locale="en-US"
      />
    </MemoryRouter>,
  )
}

describe('CalendarTimeline', () => {
  it('[P0] clamps multi-day bars at both visible week edges', () => {
    const calendar = {
      ...mockCalendarMonth,
      absences: [
        {
          ...mockCalendarMonth.absences[0],
          dateFrom: '2026-06-05',
          dateTo: '2026-06-08',
          workingDays: 2,
        },
        {
          ...mockCalendarMonth.absences[0],
          requestId: 12,
          userId: 4,
          userFullName: 'Mike Davis',
          userInitials: 'MD',
          dateFrom: '2026-06-12',
          dateTo: '2026-06-15',
          workingDays: 2,
        },
      ],
    }

    renderTimeline(calendar)

    expect(screen.getByTestId('calendar-person-2')).toHaveTextContent('Sarah Chen')
    expect(screen.getByTestId('calendar-event-10')).toHaveStyle({
      gridColumn: '2 / span 2',
    })
    expect(screen.getByTestId('calendar-event-12')).toHaveStyle({
      gridColumn: '7 / span 2',
    })
    expect(screen.getByTestId('calendar-event-10')).toHaveAccessibleName(
      'Open request context for Sarah Chen, Annual Leave, Off, Jun 5, 2026 – Jun 8, 2026',
    )
  })

  it('[P0] highlights today and identifies holidays and weekend headers', () => {
    renderTimeline(mockCalendarMonth, '2026-06-14')

    expect(screen.getByText('Mon 15').closest('.calendar-timeline-day')).toHaveClass('today')
    expect(screen.getByText('Mon 15').closest('.calendar-timeline-day')).toHaveAttribute(
      'aria-current',
      'date',
    )
    expect(screen.getByText('Tue 16').closest('.calendar-timeline-day')).not.toHaveAttribute(
      'aria-current',
    )
    expect(screen.getByLabelText('Thu 18, Founders Day')).toHaveClass('holiday')
    expect(screen.getByText('Sun 14').closest('.calendar-timeline-day')).toHaveClass('weekend')
    expect(screen.getByText('Sat 20').closest('.calendar-timeline-day')).toHaveClass('weekend')
  })

  it('[P1] reports days where two or more distinct people are away', () => {
    const calendar = {
      ...mockCalendarMonth,
      absences: [
        mockCalendarMonth.absences[0],
        {
          ...mockCalendarMonth.absences[1],
          presence: 'OFF' as const,
          dateFrom: '2026-06-11',
          dateTo: '2026-06-12',
        },
      ],
    }

    renderTimeline(calendar)

    expect(screen.getByTestId('calendar-coverage-alert')).toHaveTextContent(
      'Coverage alert — 2 days this week with 2+ people away (Thu 11 and Fri 12)',
    )
  })

  it('[P1] excludes WFH, duplicate requests, and configured weekend days from coverage risk', () => {
    const calendar = {
      ...mockCalendarMonth,
      absences: [
        {
          ...mockCalendarMonth.absences[0],
          dateFrom: '2026-06-07',
          dateTo: '2026-06-10',
        },
        {
          ...mockCalendarMonth.absences[0],
          requestId: 12,
          dateFrom: '2026-06-10',
          dateTo: '2026-06-10',
        },
        {
          ...mockCalendarMonth.absences[0],
          requestId: 13,
          userId: 4,
          userFullName: 'Mike Davis',
          userInitials: 'MD',
          dateFrom: '2026-06-07',
          dateTo: '2026-06-07',
        },
        {
          ...mockCalendarMonth.absences[1],
          dateFrom: '2026-06-10',
          dateTo: '2026-06-10',
        },
      ],
    }

    renderTimeline(calendar)

    expect(screen.queryByTestId('calendar-coverage-alert')).not.toBeInTheDocument()
  })

  it('[P1] places overlapping requests for one person in separate visible lanes', () => {
    const calendar = {
      ...mockCalendarMonth,
      absences: [
        {
          ...mockCalendarMonth.absences[0],
          dateFrom: '2026-06-08',
          dateTo: '2026-06-10',
        },
        {
          ...mockCalendarMonth.absences[0],
          requestId: 12,
          dateFrom: '2026-06-09',
          dateTo: '2026-06-11',
        },
        {
          ...mockCalendarMonth.absences[0],
          requestId: 13,
          dateFrom: '2026-06-12',
          dateTo: '2026-06-13',
        },
      ],
    }

    renderTimeline(calendar)

    expect(screen.getByTestId('calendar-person-2')).toHaveStyle({
      gridTemplateRows: 'repeat(2, 32px)',
    })
    expect(screen.getByTestId('calendar-event-10')).toHaveStyle({ gridRow: '1' })
    expect(screen.getByTestId('calendar-event-12')).toHaveStyle({ gridRow: '2' })
    expect(screen.getByTestId('calendar-event-13')).toHaveStyle({ gridRow: '1' })
  })

  it('[P1] uses Arabic plural categories for long and compact bars', async () => {
    const arabicI18n = createInstance()
    await arabicI18n.init({
      lng: 'ar',
      resources: { ar: { calendar: arCalendar } },
      defaultNS: 'calendar',
      interpolation: { escapeValue: false },
    })

    expect(arabicI18n.t('timeline.bar', { type: 'إجازة', count: 2 })).toBe(
      'إجازة · يومان',
    )
    expect(arabicI18n.t('timeline.barShort', { count: 3 })).toBe('3 أيام')
    expect(arabicI18n.t('timeline.barShort', { count: 11 })).toBe('11 يومًا')
  })

  it('[P0] skips an absence with a reversed date range (dateFrom > dateTo) instead of rendering an invalid bar', () => {
    const calendar = {
      ...mockCalendarMonth,
      absences: [
        {
          ...mockCalendarMonth.absences[0],
          dateFrom: '2026-06-08',
          dateTo: '2026-06-09',
        },
        {
          ...mockCalendarMonth.absences[0],
          requestId: 99,
          dateFrom: '2026-06-10',
          dateTo: '2026-06-05',
        },
      ],
    }

    renderTimeline(calendar)

    expect(screen.getByTestId('calendar-event-10')).toHaveStyle({ gridColumn: '3 / span 2' })
    expect(screen.queryByTestId('calendar-event-99')).not.toBeInTheDocument()
  })

  it('[P1] renders the full-coverage empty state when nobody is away', () => {
    renderTimeline({ ...mockCalendarMonth, absences: [] })

    expect(screen.getByRole('status')).toHaveTextContent(
      'No team absences this week — full coverage.',
    )
  })
})
