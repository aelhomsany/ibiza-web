import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('[P1] stays inert chips when no filter handler is supplied', () => {
    render(<CalendarLegend />)

    const legend = screen.getByLabelText('Calendar legend')
    expect(within(legend).queryAllByRole('button')).toHaveLength(0)
    expect(legend.querySelector('.cal-legend-item--button')).not.toBeInTheDocument()
  })

  it('[P1] becomes a filter control that reports the chip that was pressed', async () => {
    const user = userEvent.setup()
    const onToggleKind = vi.fn()
    render(<CalendarLegend onToggleKind={onToggleKind} />)

    const legend = screen.getByRole('group', { name: 'Filter the timeline by day type' })
    const chips = within(legend).getAllByRole('button')
    expect(chips.map((chip) => chip.lastElementChild?.textContent)).toEqual([
      'Off',
      'WFH',
      'Holiday',
    ])
    // Nothing is lit until the reader picks a kind — an unfiltered timeline is the default.
    expect(chips.every((chip) => chip.getAttribute('aria-pressed') === 'false')).toBe(true)

    await user.click(within(legend).getByTestId('cal-legend-wfh'))

    expect(onToggleKind).toHaveBeenCalledTimes(1)
    expect(onToggleKind).toHaveBeenCalledWith('WFH')
  })

  it('[P1] marks only the active kind as pressed', () => {
    render(<CalendarLegend activeKind="OFF" onToggleKind={() => undefined} />)

    expect(screen.getByTestId('cal-legend-off')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('cal-legend-off')).toHaveClass('is-active')
    expect(screen.getByTestId('cal-legend-wfh')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('cal-legend-holiday')).toHaveAttribute('aria-pressed', 'false')
  })

  it('[P1] keeps the pending-own chip filterable under its established test id', () => {
    render(<CalendarLegend showPendingOwn activeKind="PENDING" onToggleKind={() => undefined} />)

    const pendingChip = screen.getByTestId('cal-legend-pending-own')
    expect(pendingChip.tagName).toBe('BUTTON')
    expect(pendingChip).toHaveAttribute('aria-pressed', 'true')
    expect(pendingChip).toHaveTextContent('Your pending request')
  })
})
