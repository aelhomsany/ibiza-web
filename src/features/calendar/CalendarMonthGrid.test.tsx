import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
      name: 'June 18, no absences, Founders Day',
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

  it('[P0] does not present today as a selection while nothing is selected', () => {
    // The Agenda list shows the WHOLE month until a day is picked, but today used to render as
    // a filled dark pill -- the same shape `.selected` uses -- so the first open of Agenda read
    // as "filtered to today" while listing every day. Today is `aria-current`, never pressed.
    renderGrid({ selectedDate: null })

    const today = screen.getByTestId(`calendar-day-${mockCalendarMonth.today}`)
    expect(today).toHaveAttribute('aria-current', 'date')
    expect(today).toHaveAttribute('aria-pressed', 'false')
    expect(today).toHaveClass('today')
    expect(today).not.toHaveClass('selected')

    const pressed = screen
      .getAllByRole('button')
      .filter((day) => day.getAttribute('aria-pressed') === 'true')
    expect(pressed).toEqual([])
  })

  it('[P0] keeps today and selected visually distinct shapes', () => {
    // aria alone does not fix what the eye reads. Today is a ring; selected is a fill plus its
    // own halo. If these ever collapse back to two filled pills, the confusion returns.
    const calendarCss = readFileSync(join(__dirname, 'calendar.css'), 'utf-8')
    const todayRule = /\.calendar-mini-day\.today\s*\{([^}]*)\}/.exec(calendarCss)?.[1] ?? ''
    const selectedRule =
      /\.calendar-mini-day\.selected,[^{]*\{([^}]*)\}/.exec(calendarCss)?.[1] ?? ''

    expect(todayRule).not.toBe('')
    expect(todayRule).not.toMatch(/background:/)
    expect(todayRule).toMatch(/box-shadow:\s*var\(--shadow-calendar-today\)/)
    expect(selectedRule).toMatch(/background:\s*var\(--color-primary-hover\)/)

    // The token the ring comes from has to be an INSET ring, not another outer glow behind a
    // fill -- with no background on `.today`, an outer-only shadow would leave today unmarked.
    const tokensCss = readFileSync(join(__dirname, '../../styles/tokens.css'), 'utf-8')
    expect(tokensCss).toMatch(/--shadow-calendar-today:\s*inset\b/)
  })

  it('[P0] a selected today still reads as selected', () => {
    renderGrid({ selectedDate: mockCalendarMonth.today })

    const today = screen.getByTestId(`calendar-day-${mockCalendarMonth.today}`)
    expect(today).toHaveClass('today', 'selected')
    expect(today).toHaveAttribute('aria-pressed', 'true')
  })
})

/**
 * Story 10.10 — UXA-10 labelled month grid for screen-reader navigation.
 */
describe('CalendarMonthGrid accessibility ATDD — Story 10.10', () => {
  test('[P1] exposes a labelled month grid with per-day accessible names', () => {
    renderGrid()

    expect(screen.getByRole('group', { name: /june 2026/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /june 10, 1 absence/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /june 19, no absences, founders day/i })).toBeInTheDocument()
  })
})
