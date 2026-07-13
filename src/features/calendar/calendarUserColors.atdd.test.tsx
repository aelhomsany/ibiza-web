import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CalendarLegend } from './CalendarLegend'
import { CalendarMonthGrid } from './CalendarMonthGrid'
import { mockCalendarMonth } from './calendarTestFixtures'

function renderGrid(calendar = mockCalendarMonth) {
  return render(
    <MemoryRouter>
      <CalendarMonthGrid calendar={calendar} month="2026-06" />
    </MemoryRouter>,
  )
}

function withSingleAbsence(overrides: Partial<(typeof mockCalendarMonth.absences)[number]>) {
  return {
    ...mockCalendarMonth,
    absences: [
      {
        ...mockCalendarMonth.absences[0],
        requestId: 99,
        userId: 99,
        userInitials: 'ZZ',
        dateFrom: '2026-06-05',
        dateTo: '2026-06-05',
        ...overrides,
      },
    ],
  }
}

describe('calendar user colors ATDD — Story 10.5', () => {
  it('[P0] event chips carry --chip-bg from the userId hash instead of cal-event--user-N classes', () => {
    renderGrid()

    const chip = screen.getByTestId('calendar-event-10-2026-06-10')
    expect(chip.style.getPropertyValue('--chip-bg')).toBeTruthy()
    expect(chip.style.getPropertyValue('--chip-fg')).toBeTruthy()
    expect(chip.className).not.toMatch(/cal-event--user-\d/)
  })

  it('[P0] a user beyond the legacy 8-color palette gets a hash style, not a wrapped modulo class', () => {
    renderGrid(withSingleAbsence({ userColorKey: 'user-11' }))

    const chip = screen.getByTestId('calendar-event-99')
    expect(chip.className).not.toMatch(/cal-event--user-\d/)
    expect(chip.style.getPropertyValue('--chip-bg')).toBeTruthy()
  })

  it('[P0] two users colliding under the legacy modulo palette now render distinct backgrounds', () => {
    const calendar = {
      ...mockCalendarMonth,
      absences: [
        withSingleAbsence({ requestId: 98, userId: 3, userInitials: 'AA', userColorKey: 'user-3' })
          .absences[0],
        withSingleAbsence({ requestId: 99, userId: 11, userInitials: 'ZZ', userColorKey: 'user-11' })
          .absences[0],
      ],
    }
    renderGrid(calendar)

    const chipA = screen.getByTestId('calendar-event-98')
    const chipB = screen.getByTestId('calendar-event-99')
    expect(chipA.style.getPropertyValue('--chip-bg')).toBeTruthy()
    expect(chipA.style.getPropertyValue('--chip-bg')).not.toBe(
      chipB.style.getPropertyValue('--chip-bg'),
    )
  })

  it('[P0] presence borders still apply on top of the hash background', () => {
    renderGrid()

    const wfhChip = screen.getByTestId('calendar-event-11')
    expect(wfhChip).toHaveClass('cal-event--wfh')
    expect(wfhChip.style.getPropertyValue('--chip-bg')).toBeTruthy()

    const offChip = screen.getByTestId('calendar-event-10-2026-06-10')
    expect(offChip).toHaveClass('cal-event--off')
  })

  it('[P0] legend dots use the same --chip-bg as the chips for the same user', () => {
    renderGrid()
    render(
      <CalendarLegend absences={mockCalendarMonth.absences} holidays={mockCalendarMonth.holidays} />,
    )

    const sarahDot = screen.getByText('Sarah').previousElementSibling as HTMLElement
    expect(sarahDot.className).not.toMatch(/cal-user-dot--user-\d/)

    const sarahChip = screen.getByTestId('calendar-event-10-2026-06-10')
    expect(sarahDot.style.getPropertyValue('--chip-bg')).toBe(
      sarahChip.style.getPropertyValue('--chip-bg'),
    )
  })

  it('[P0] legend holiday group pills use group-pill with inline pill vars, not name-keyed classes', () => {
    render(
      <CalendarLegend absences={mockCalendarMonth.absences} holidays={mockCalendarMonth.holidays} />,
    )

    const usPill = screen.getByText('US')
    const egyptPill = screen.getByText('Egypt')

    for (const pill of [usPill, egyptPill]) {
      expect(pill).toHaveClass('group-pill')
      expect(pill).not.toHaveClass('group-pill-us')
      expect(pill).not.toHaveClass('group-pill-egypt')
      expect((pill as HTMLElement).style.getPropertyValue('--pill-bg')).toBeTruthy()
    }

    expect((usPill as HTMLElement).style.getPropertyValue('--pill-bg')).not.toBe(
      (egyptPill as HTMLElement).style.getPropertyValue('--pill-bg'),
    )
  })
})
