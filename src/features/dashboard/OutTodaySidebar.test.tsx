import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import type { OutTodayResponse, UpcomingAbsenceResponse } from '../../api/generated/types'
import { OutTodaySidebar } from './OutTodaySidebar'

const mockOutToday: OutTodayResponse[] = [
  {
    userId: 3,
    fullName: 'Mike Davis',
    initials: 'MD',
    leaveTypeName: 'Work From Home',
    leaveTypeIcon: '🏠',
    presence: 'WFH',
  },
  {
    userId: 4,
    fullName: 'Emma Wilson',
    initials: 'EW',
    leaveTypeName: 'Annual Leave',
    leaveTypeIcon: '🌴',
    presence: 'OFF',
  },
]

const mockUpcoming: UpcomingAbsenceResponse[] = [
  {
    id: 10,
    userId: 4,
    fullName: 'Emma Wilson',
    dateFrom: '2026-06-28',
    workingDays: 2,
    leaveTypeIcon: '🏠',
  },
]

function renderSidebar(
  outToday = mockOutToday,
  upcoming = mockUpcoming,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole('EMPLOYEE')}>
        <OutTodaySidebar outToday={outToday} upcoming={upcoming} />
      </AuthTestProvider>
    </QueryClientProvider>,
  )
}

describe('OutTodaySidebar — Story 3.2', () => {
  it('[P1] renders WFH badge for Work From Home presence', () => {
    renderSidebar()
    expect(screen.getByText('WFH')).toBeInTheDocument()
  })

  it('[P1] renders Off badge for non-WFH approved leave', () => {
    renderSidebar()
    expect(screen.getByText('Off')).toBeInTheDocument()
  })

  it('[P1] shows everyone in today empty state', () => {
    renderSidebar([], [])
    expect(screen.getByText(/Everyone is in today/i)).toBeInTheDocument()
    expect(screen.getByText(/No upcoming leaves in next 30 days/i)).toBeInTheDocument()
  })

  it('[P1] renders upcoming row with working day count', () => {
    renderSidebar()
    expect(screen.getByText(/2d working/i)).toBeInTheDocument()
  })

  it('[P1] summarizes returned coverage facts without a risk threshold', () => {
    renderSidebar()

    const summary = screen.getByTestId('coverage-summary')
    expect(summary).toHaveTextContent('Off today')
    expect(summary).toHaveTextContent('WFH today')
    expect(summary).toHaveTextContent('Next 30 days')
    expect(summary).toHaveTextContent(
      '1 team member is recorded off today.',
    )
    expect(summary).not.toHaveTextContent(/risk|capacity|percent/i)
  })
})
