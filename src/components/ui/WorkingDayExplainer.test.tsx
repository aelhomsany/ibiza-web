import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WorkingDayExplainer, type WorkingDayEvidence } from './WorkingDayExplainer'

const days: WorkingDayEvidence[] = [
  {
    date: '2026-08-16',
    displayDate: 'Sun 16 Aug',
    kind: 'weekend',
    reason: 'Weekend',
  },
  {
    date: '2026-08-14',
    displayDate: 'Fri 14 Aug',
    kind: 'charged',
    reason: 'Charged',
  },
  {
    date: '2026-08-15',
    displayDate: 'Sat 15 Aug',
    kind: 'holiday',
    reason: 'Holiday — Founders Day',
  },
]

describe('WorkingDayExplainer', () => {
  it('[P0] renders result, chronological text-labelled chips, then policy', () => {
    render(
      <WorkingDayExplainer
        state="valid"
        stateMessage=""
        resultLabel="1 working day will be charged"
        excludedSummary="2 dates excluded"
        policyLabel="US Workforce Group · Saturday/Sunday weekend"
        days={days}
      />,
    )

    const explainer = screen.getByTestId('working-day-explainer')
    const result = screen.getByTestId('working-day-result')
    const chips = screen.getByTestId('working-day-chips')
    const policy = screen.getByTestId('working-day-policy')

    expect(result.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(chips.compareDocumentPosition(policy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const items = within(chips).getAllByRole('listitem')
    expect(items.map((item) => item.getAttribute('data-date'))).toEqual([
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
    ])
    expect(items[0]).toHaveTextContent('Charged')
    expect(items[1]).toHaveTextContent('Holiday — Founders Day')
    expect(items[2]).toHaveTextContent('Weekend')
    expect(explainer).toHaveTextContent('US Workforce Group')
  })

  it.each([
    ['before-dates' as const, 'Select dates to preview working days'],
    ['loading' as const, 'Calculating working days…'],
    ['error' as const, "We couldn't load the calculation"],
  ])('[P0] %s state never renders a guessed total', (state, stateMessage) => {
    render(<WorkingDayExplainer state={state} stateMessage={stateMessage} />)

    expect(screen.queryByTestId('working-day-result')).not.toBeInTheDocument()
    expect(screen.getByText(stateMessage)).toBeInTheDocument()
  })

  it('[P0] zero state explains the block while keeping policy evidence visible', () => {
    render(
      <WorkingDayExplainer
        state="zero"
        stateMessage="The selected range contains no working days."
        resultLabel="No working days"
        policyLabel="Egypt Workforce Group · Friday/Saturday weekend"
        days={days.filter((day) => day.kind !== 'charged')}
      />,
    )

    expect(screen.getByTestId('working-day-result')).toHaveTextContent('No working days')
    expect(screen.getByRole('alert')).toHaveTextContent('contains no working days')
    expect(screen.getByTestId('working-day-policy')).toHaveTextContent('Egypt Workforce Group')
  })

  it('[P1] compact disclosure preserves evidence after collapse and reopen', async () => {
    const user = userEvent.setup()
    render(
      <WorkingDayExplainer
        state="valid"
        stateMessage=""
        resultLabel="1 working day"
        policyLabel="US Workforce Group"
        days={days}
        compact
        detailsLabel="How this is calculated"
      />,
    )

    const summary = screen.getByText('How this is calculated')
    await user.click(summary)
    expect(screen.getByTestId('working-day-chips')).toBeVisible()
    await user.click(summary)
    await user.click(summary)
    expect(screen.getByTestId('working-day-policy')).toHaveTextContent('US Workforce Group')
  })

  it('[P0] exposes a retry action for preview failure', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <WorkingDayExplainer
        state="error"
        stateMessage="Calculation unavailable"
        retryLabel="Retry"
        onRetry={onRetry}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('[P1] omits empty evidence lists and disclosures when no date evidence exists', () => {
    render(
      <WorkingDayExplainer
        state="valid"
        stateMessage=""
        resultLabel="3 working days"
        compact
        detailsLabel="How this is calculated"
      />,
    )

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByText('How this is calculated')).not.toBeInTheDocument()
  })
})
