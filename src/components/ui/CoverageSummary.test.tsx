import { render, screen, within } from '@testing-library/react'
import { CoverageSummary } from './CoverageSummary'

const props = {
  label: 'Team coverage summary',
  offToday: 1,
  workingFromHomeToday: 2,
  upcoming: 3,
  offLabel: 'Off today',
  workingFromHomeLabel: 'WFH today',
  upcomingLabel: 'Next 30 days',
  stateLabel: '1 team member is recorded off today.',
}

describe('CoverageSummary', () => {
  it('[P1] exposes a named text-first region without risk inference', () => {
    render(<CoverageSummary {...props} />)

    const region = screen.getByRole('region', {
      name: 'Team coverage summary',
    })
    expect(within(region).getByText('Off today')).toBeInTheDocument()
    expect(within(region).getByText('WFH today')).toBeInTheDocument()
    expect(within(region).getByText('Next 30 days')).toBeInTheDocument()
    expect(region).toHaveTextContent('1 team member is recorded off today.')
    expect(region).not.toHaveTextContent(/risk|capacity|percent/i)
  })

  it('[P1] announces loading without presenting stale facts', () => {
    render(
      <CoverageSummary
        {...props}
        isLoading
        loadingLabel="Updating team coverage…"
      />,
    )

    const status = screen.getByRole('status', {
      name: 'Team coverage summary',
    })
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status).toHaveTextContent('Updating team coverage…')
    expect(screen.queryByText('Off today')).not.toBeInTheDocument()
  })
})
