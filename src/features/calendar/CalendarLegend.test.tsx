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
    expect(sarahRow.previousElementSibling).toHaveClass('cal-user-dot', 'cal-user-dot--user-0')
    expect(omarRow.previousElementSibling).toHaveClass('cal-user-dot', 'cal-user-dot--user-1')
    expect(sarahRow).toBeInTheDocument()
    expect(omarRow).toBeInTheDocument()
    expect(legend).toBeInTheDocument()
    expect(screen.getByText('US')).toHaveClass('group-pill-us')
    expect(screen.getByText('Egypt')).toHaveClass('group-pill-egypt')
  })
})
