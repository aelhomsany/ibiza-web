import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { CalendarMonthResponse } from '../../api/generated/types'
import { CalendarAgenda } from './CalendarAgenda'
import { mockCalendarMonth } from './calendarTestFixtures'

function AgendaHarness({ calendar = mockCalendarMonth }: { calendar?: CalendarMonthResponse }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  return (
    <MemoryRouter>
      <CalendarAgenda
        calendar={calendar}
        month="2026-06"
        weekendDays={calendar.viewerWeekendDays}
        selectedDate={selectedDate}
        onSelectedDateChange={setSelectedDate}
        locale="en-US"
      />
    </MemoryRouter>
  )
}

describe('CalendarAgenda', () => {
  it('[P0] filters inclusively across multi-day leave and clears on a repeated day click', async () => {
    const user = userEvent.setup()
    render(<AgendaHarness />)

    const day = screen.getByRole('button', { name: /June 11, 1 absence/i })
    await user.click(day)

    expect(day).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Sarah Chen — Annual Leave')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-event-10')).toHaveAccessibleName(
      'Open request context for Sarah Chen, Annual Leave, Off, Jun 10, 2026 – Jun 12, 2026',
    )
    expect(screen.queryByText('Omar Hassan — Work From Home')).not.toBeInTheDocument()

    await user.click(day)

    expect(day).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Omar Hassan — Work From Home')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-event-11')).toHaveAccessibleName(
      'Omar Hassan, Work From Home, WFH, Jun 15, 2026',
    )
  })

  it('[P0] includes a multi-day holiday on its final selected date', async () => {
    const user = userEvent.setup()
    render(<AgendaHarness />)

    await user.click(screen.getByRole('button', { name: /June 19, no absences, Founders Day/i }))

    expect(screen.getByRole('heading', { name: 'Friday, June 19' })).toBeInTheDocument()
    expect(screen.getByText('Founders Day — Public Holiday')).toBeInTheDocument()
    expect(screen.queryByText('Sarah Chen — Annual Leave')).not.toBeInTheDocument()
  })

  it('[P1] sorts absence and holiday cards by their start date', () => {
    const { container } = render(<AgendaHarness />)

    const itemIds = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid^="calendar-event-"], [data-testid^="calendar-holiday-"]'),
      (item) => item.dataset.testid,
    )
    expect(itemIds).toEqual([
      'calendar-event-10',
      'calendar-event-11',
      'calendar-holiday-7',
      'calendar-holiday-8',
    ])
  })

  it('[P1] explains full coverage when the selected day has no items', async () => {
    const user = userEvent.setup()
    render(<AgendaHarness />)

    await user.click(screen.getByRole('button', { name: /June 30, no absences/i }))

    expect(screen.getByRole('status')).toHaveTextContent(
      'Nothing on this day — full coverage.',
    )
  })

  it('[P1] renders the server-scoped available count, not a re-derived one', () => {
    // Sarah Chen's OFF absence overlaps June 11, so a naive client re-derivation would compute
    // audienceMemberCount(8) - offPeople.size(1) = 7. The server-provided availableCountByDate
    // is deliberately set to disagree (5) here -- proving the component renders that value
    // verbatim instead of recomputing it from audienceMemberCount and the absences list.
    const calendar: CalendarMonthResponse = {
      ...mockCalendarMonth,
      availableCountByDate: {
        ...mockCalendarMonth.availableCountByDate,
        '2026-06-11': 5,
      },
    }
    render(<AgendaHarness calendar={calendar} />)

    const availability = screen.getByTestId('calendar-availability-2026-06-11')
    expect(availability).toHaveTextContent('5 of 8 available')
    expect(availability).not.toHaveTextContent('7 of 8 available')
  })

  // AVAIL-UI-VAL-003 (P0): availableCountByDate is optional in the contract, so a day can arrive
  // with no entry. That means "never computed", not "nobody is available" -- defaulting the gap to
  // zero renders "0 of 8 available", the most alarming possible reading, as though the server had
  // asserted it.
  it('[P0] says the count is unavailable rather than rendering a missing day as zero', () => {
    const withoutTheDay = { ...mockCalendarMonth.availableCountByDate }
    delete withoutTheDay['2026-06-11']
    const calendar: CalendarMonthResponse = {
      ...mockCalendarMonth,
      availableCountByDate: withoutTheDay,
    }
    render(<AgendaHarness calendar={calendar} />)

    const availability = screen.getByTestId('calendar-availability-2026-06-11')
    expect(availability).not.toHaveTextContent('0 of 8 available')
    expect(availability).toHaveTextContent('Availability count unavailable')
  })
})

/**
 * Story 10.10 — UXA-10 accessible agenda representation (behavioral semantics).
 */
describe('CalendarAgenda accessibility ATDD — Story 10.10', () => {
  test('[P1] exposes a labelled agenda section with text-based list entries', () => {
    render(<AgendaHarness />)

    expect(screen.getByRole('region', { name: /agenda/i })).toBeInTheDocument()
    expect(screen.getByText('Sarah Chen — Annual Leave')).toBeInTheDocument()
    expect(screen.getByText('Omar Hassan — Work From Home')).toBeInTheDocument()
  })
})
