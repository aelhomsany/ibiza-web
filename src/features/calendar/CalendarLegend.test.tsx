import { render, screen, within } from '@testing-library/react'
import { CalendarLegend } from './CalendarLegend'

describe('CalendarLegend', () => {
  it('[P1] contains only the generic Off, WFH, and Holiday entries', () => {
    render(<CalendarLegend />)

    const legend = screen.getByLabelText('Calendar legend')
    const entries = Array.from(legend.querySelectorAll('.cal-legend-item'))

    expect(legend.children).toHaveLength(3)
    expect(entries.map((entry) => entry.lastElementChild?.textContent)).toEqual([
      'Off',
      'WFH',
      'Holiday',
    ])
    expect(within(legend).getByText('Off')).toBeInTheDocument()
    expect(within(legend).getByText('WFH')).toBeInTheDocument()
    expect(within(legend).getByText('Holiday')).toBeInTheDocument()
    expect(legend.querySelector('.cal-user-dot, .group-pill')).not.toBeInTheDocument()

    for (const removedEntry of ['Sarah', 'Omar', 'US', 'Egypt']) {
      expect(within(legend).queryByText(removedEntry)).not.toBeInTheDocument()
    }
  })

  it('[P1] distinguishes Off, WFH, and Holiday with their generic swatches', () => {
    render(<CalendarLegend />)

    const legend = screen.getByLabelText('Calendar legend')
    expect(legend.querySelector('.cal-legend-presence--off')).toBeInTheDocument()
    expect(legend.querySelector('.cal-legend-presence--wfh')).toBeInTheDocument()
    expect(legend.querySelector('.cal-holiday-swatch')).toBeInTheDocument()
  })
})
