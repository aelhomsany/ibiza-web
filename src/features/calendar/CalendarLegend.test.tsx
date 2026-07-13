import { render, screen } from '@testing-library/react'
import { CalendarLegend } from './CalendarLegend'
import { mockCalendarMonth } from './calendarTestFixtures'

describe('CalendarLegend', () => {
  it('[P1] explains Off, WFH, Holiday, user colors, and holiday groups', () => {
    render(
      <CalendarLegend
        absences={mockCalendarMonth.absences}
        holidays={mockCalendarMonth.holidays}
      />,
    )

    expect(screen.getByText('Off')).toBeInTheDocument()
    expect(screen.getByText('WFH')).toBeInTheDocument()
    expect(screen.getByText('Holiday')).toBeInTheDocument()
    const legend = screen.getByLabelText('Calendar legend')
    const sarahRow = screen.getByText('Sarah')
    const omarRow = screen.getByText('Omar')
    const sarahDot = sarahRow.previousElementSibling as HTMLElement
    const omarDot = omarRow.previousElementSibling as HTMLElement
    expect(sarahDot).toHaveClass('cal-user-dot')
    expect(omarDot).toHaveClass('cal-user-dot')
    expect(sarahDot.className).not.toMatch(/cal-user-dot--user-\d/)
    expect(omarDot.className).not.toMatch(/cal-user-dot--user-\d/)
    expect(sarahDot.style.getPropertyValue('--chip-bg')).toBeTruthy()
    expect(omarDot.style.getPropertyValue('--chip-bg')).toBeTruthy()
    expect(sarahRow).toBeInTheDocument()
    expect(omarRow).toBeInTheDocument()
    expect(legend).toBeInTheDocument()

    const usPill = screen.getByText('US')
    const egyptPill = screen.getByText('Egypt')
    expect(usPill).toHaveClass('group-pill')
    expect(egyptPill).toHaveClass('group-pill')
    expect(usPill).not.toHaveClass('group-pill-us')
    expect(egyptPill).not.toHaveClass('group-pill-egypt')
    expect((usPill as HTMLElement).style.getPropertyValue('--pill-bg')).toBeTruthy()
    expect((egyptPill as HTMLElement).style.getPropertyValue('--pill-bg')).toBeTruthy()
  })
})
