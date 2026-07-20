import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CalendarMonthGrid } from './CalendarMonthGrid'
import { mockCalendarMonth } from './calendarTestFixtures'

type GridProps = ComponentProps<typeof CalendarMonthGrid>

function renderGrid(overrides: Partial<GridProps> = {}) {
  const props: GridProps = {
    calendar: mockCalendarMonth,
    month: '2026-06',
    ...overrides,
  }

  return render(
    <MemoryRouter>
      <CalendarMonthGrid {...props} />
    </MemoryRouter>,
  )
}

describe('CalendarMonthGrid', () => {
  it('[P0] renders the mini month as accessible day buttons and reports selection', async () => {
    const user = userEvent.setup()
    const onSelectDate = vi.fn()
    renderGrid({ onSelectDate })

    expect(screen.getByTestId('calendar-mini-month')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'June 2026' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(30)

    const absenceDay = screen.getByRole('button', { name: 'June 10, 1 absence' })
    expect(absenceDay).toHaveAttribute('type', 'button')
    expect(absenceDay).toHaveAttribute('aria-pressed', 'false')

    await user.click(absenceDay)

    expect(onSelectDate).toHaveBeenCalledOnce()
    expect(onSelectDate).toHaveBeenCalledWith('2026-06-10')
  })

  it('[P0/P1] exposes selected, today, weekend, and holiday states on their day buttons', () => {
    renderGrid({ selectedDate: '2026-06-18' })

    const today = screen.getByTestId('calendar-day-2026-06-15')
    const weekend = screen.getByTestId('calendar-day-2026-06-14')
    const selectedHoliday = screen.getByRole('button', {
      name: 'June 18, no absences, 1 holiday',
    })

    expect(today).toHaveClass('calendar-mini-day', 'today')
    expect(today).toHaveAttribute('aria-current', 'date')
    expect(today).toHaveAttribute('aria-pressed', 'false')
    expect(weekend).not.toHaveAttribute('aria-current')
    expect(weekend).toHaveClass('calendar-mini-day', 'weekend')
    expect(selectedHoliday).toHaveClass('calendar-mini-day', 'selected', 'holiday')
    expect(selectedHoliday).toHaveAttribute('aria-pressed', 'true')
  })

  it('[P1] marks absence days with a single decorative user-colored dot', () => {
    renderGrid()

    for (const date of ['2026-06-10', '2026-06-11', '2026-06-12', '2026-06-15']) {
      const day = screen.getByTestId(`calendar-day-${date}`)
      const dots = day.querySelectorAll('.calendar-mini-absence-dot')

      expect(dots).toHaveLength(1)
      expect(dots[0]).toHaveAttribute('aria-hidden', 'true')
      expect(day.style.getPropertyValue('--chip-bg')).toBeTruthy()
    }

    const clearDay = screen.getByRole('button', { name: 'June 13, no absences' })
    expect(clearDay.querySelector('.calendar-mini-absence-dot')).not.toBeInTheDocument()
  })
})

/**
 * Story 10.10 — UXA-10 labelled month grid for screen-reader navigation.
 */
describe('CalendarMonthGrid accessibility ATDD — Story 10.10', () => {
  test('[P1] exposes a labelled month grid with per-day accessible names', () => {
    renderGrid()

    expect(screen.getByRole('grid', { name: /june 2026/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /june 10, 1 absence/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /june 19, no absences, 1 holiday/i })).toBeInTheDocument()
  })
})
