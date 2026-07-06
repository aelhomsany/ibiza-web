import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CalendarMonthGrid } from './CalendarMonthGrid'
import { mockCalendarMonth } from './calendarTestFixtures'

function renderGrid(calendar = mockCalendarMonth) {
  return render(
    <MemoryRouter>
      <CalendarMonthGrid calendar={calendar} month="2026-06" />
    </MemoryRouter>,
  )
}

describe('CalendarMonthGrid', () => {
  it('[P0] renders weekday headers and month day cells', () => {
    renderGrid()

    expect(screen.getByTestId('calendar-month-grid')).toBeInTheDocument()
    for (const dayName of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      expect(screen.getByText(dayName)).toBeInTheDocument()
    }
    expect(screen.getByTestId('calendar-day-2026-06-01')).toHaveTextContent('1')
    expect(screen.getByTestId('calendar-day-2026-06-30')).toHaveTextContent('30')
  })

  it('[P0] renders approved absences as initials chips on every overlapping day', () => {
    renderGrid()

    for (const date of ['2026-06-10', '2026-06-11', '2026-06-12']) {
      expect(within(screen.getByTestId(`calendar-day-${date}`)).getByText('SC')).toBeInTheDocument()
    }
  })

  it('[P0/P1] applies today, weekend, holiday, and presence classes from API data', () => {
    renderGrid()

    expect(screen.getByTestId('calendar-day-2026-06-15')).toHaveClass('today')
    expect(screen.getByTestId('calendar-day-2026-06-14')).toHaveClass('weekend')
    expect(screen.getByTestId('calendar-day-2026-06-18')).toHaveClass('holiday')
    expect(screen.getByTestId('calendar-event-11')).toHaveClass('cal-event--wfh')
    expect(screen.getByTestId('calendar-event-10-2026-06-10')).toHaveClass('cal-event--off')
  })

  it('[P1] wraps user color keys beyond the palette size into a defined token', () => {
    const calendar = {
      ...mockCalendarMonth,
      absences: [
        {
          ...mockCalendarMonth.absences[0],
          requestId: 99,
          userId: 99,
          userInitials: 'ZZ',
          userColorKey: 'user-11',
          dateFrom: '2026-06-05',
          dateTo: '2026-06-05',
        },
      ],
    }
    renderGrid(calendar)

    // user-11 must map into the 8-color palette (11 % 8 = 3), never an undefined token.
    expect(screen.getByTestId('calendar-event-99')).toHaveClass('cal-event--user-3')
  })

  it('[P1] renders holiday names and workforce group pills for every holiday range day', () => {
    renderGrid()

    for (const date of ['2026-06-18', '2026-06-19']) {
      const cell = within(screen.getByTestId(`calendar-day-${date}`))
      expect(cell.getByText('Founders Day')).toBeInTheDocument()
      expect(cell.getByText('US')).toHaveClass('group-pill-us')
    }
  })
})
