import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { MemoryRouter } from 'react-router-dom'
import type { CalendarMonthResponse } from '../../api/generated/types'
import arCalendar from '../../i18n/locales/ar/calendar.json'
import { CalendarTimeline } from './CalendarTimeline'
import type { CalendarKind } from './calendarKinds'
import { mockCalendarMonth } from './calendarTestFixtures'

function renderTimeline(
  calendar: CalendarMonthResponse = mockCalendarMonth,
  weekStart = '2026-06-07',
  filter: { activeKind?: CalendarKind | null, onClearKindFilter?: () => void } = {},
) {
  return render(
    <MemoryRouter>
      <CalendarTimeline
        calendar={calendar}
        weekStart={weekStart}
        weekendDays={calendar.viewerWeekendDays}
        locale="en-US"
        activeKind={filter.activeKind ?? null}
        onClearKindFilter={filter.onClearKindFilter}
      />
    </MemoryRouter>,
  )
}

/**
 * One week (Jun 7–13) holding all three kinds at once: Sarah Chen off Jun 10–12, Omar Hassan
 * working from home on the 11th, Mike Davis off on the 11th (so the coverage alert fires), and
 * a holiday on the 9th.
 */
function weekWithEveryKind(): CalendarMonthResponse {
  return {
    ...mockCalendarMonth,
    absences: [
      mockCalendarMonth.absences[0],
      { ...mockCalendarMonth.absences[1], dateFrom: '2026-06-11', dateTo: '2026-06-11' },
      {
        ...mockCalendarMonth.absences[0],
        requestId: 13,
        userId: 4,
        userFullName: 'Mike Davis',
        userInitials: 'MD',
        dateFrom: '2026-06-11',
        dateTo: '2026-06-11',
        workingDays: 1,
        workingDates: ['2026-06-11'],
      },
    ],
    holidays: [
      ...mockCalendarMonth.holidays,
      {
        holidayId: 9,
        workforceGroupId: 1,
        workforceGroupName: 'US',
        name: 'Spring Break',
        dateFrom: '2026-06-09',
        dateTo: '2026-06-09',
      },
    ],
  }
}

describe('CalendarTimeline', () => {
  it('[P0] renders a privacy-redacted absence with no "undefined" anywhere (PRIV-UI-VAL-002)', () => {
    // Timeline is the DEFAULT calendar view and it passes its own `title`/`accessibleName` into
    // CalendarEventChip, which overrides the chip's own fallbacks. Under the D-14 defaults every
    // same-group and organization peer gets these keys omitted, so this is the ordinary
    // rendering path for a peer — not an edge case (code review 2026-08-29).
    const redacted = { ...mockCalendarMonth.absences[0], requestId: 40, dateFrom: '2026-06-10', dateTo: '2026-06-11' }
    delete (redacted as Record<string, unknown>).userFullName
    delete (redacted as Record<string, unknown>).userInitials
    delete (redacted as Record<string, unknown>).userWorkforceGroupName
    delete (redacted as Record<string, unknown>).leaveTypeName
    delete (redacted as Record<string, unknown>).canViewRequestContext

    const { container } = renderTimeline({ ...mockCalendarMonth, absences: [redacted] })

    expect(container.innerHTML).not.toContain('undefined')
    const chip = screen.getByTestId('calendar-event-40')
    expect(chip.getAttribute('title')).not.toContain('undefined')
    expect(chip.getAttribute('aria-label')).not.toContain('undefined')
    expect(chip.getAttribute('title')).toContain('A teammate')
    expect(chip.getAttribute('title')).toContain('Details hidden')
    // No drill-in link when the viewer may not open the request.
    expect(chip.tagName).toBe('SPAN')
    // The person rail falls back too, and a withheld group is "A group", never "A teammate".
    expect(screen.getByText('A teammate')).toBeInTheDocument()
    expect(screen.getByText('A group')).toBeInTheDocument()
  })

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

  it('[P1] shows every kind until a legend chip is pressed', () => {
    renderTimeline(weekWithEveryKind())

    expect(screen.getByTestId('calendar-event-10')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-event-11')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-event-13')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-holiday-column-2026-06-09')).toBeInTheDocument()
  })

  it('[P1] filtering to Off drops the WFH bar and the holiday tint', () => {
    renderTimeline(weekWithEveryKind(), '2026-06-07', { activeKind: 'OFF' })

    expect(screen.getByTestId('calendar-event-10')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-event-13')).toBeInTheDocument()
    expect(screen.queryByTestId('calendar-event-11')).not.toBeInTheDocument()
    expect(screen.queryByTestId('calendar-holiday-column-2026-06-09')).not.toBeInTheDocument()
    // The person rail follows the bars: nobody keeps a row with nothing on it.
    expect(screen.queryByTestId('calendar-person-3')).not.toBeInTheDocument()
  })

  it('[P1] keeps the coverage alert speaking for the whole week while a filter is on', () => {
    // Coverage is a fact about the week, not about the current filter. Narrowing to WFH hides
    // both Off bars, and telling the reader the week is covered would be a lie.
    renderTimeline(weekWithEveryKind(), '2026-06-07', { activeKind: 'WFH' })

    expect(screen.getByTestId('calendar-event-11')).toBeInTheDocument()
    expect(screen.queryByTestId('calendar-event-10')).not.toBeInTheDocument()
    expect(screen.getByTestId('calendar-coverage-alert')).toHaveTextContent(
      'Coverage alert — 1 day this week with 2+ people away (Thu 11)',
    )
  })

  it('[P1] filtering to Holiday keeps the day tint and offers a way back', async () => {
    const user = userEvent.setup()
    const onClearKindFilter = vi.fn()
    renderTimeline(weekWithEveryKind(), '2026-06-07', {
      activeKind: 'HOLIDAY',
      onClearKindFilter,
    })

    expect(screen.getByTestId('calendar-holiday-column-2026-06-09')).toBeInTheDocument()
    expect(screen.queryByTestId('calendar-event-10')).not.toBeInTheDocument()
    expect(screen.queryByTestId('calendar-event-11')).not.toBeInTheDocument()

    const empty = screen.getByTestId('calendar-timeline-empty-filtered')
    expect(empty).toHaveTextContent('Nothing on this week matches that filter.')
    // Never the "full coverage" copy: the week is full of absences, they are just filtered out.
    expect(empty).not.toHaveTextContent('full coverage')

    await user.click(screen.getByRole('button', { name: 'Show all' }))
    expect(onClearKindFilter).toHaveBeenCalledTimes(1)
  })
})
