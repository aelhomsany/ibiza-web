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
  it('[P1] renders a privacy-redacted row without leaking undefined (Story 16.2)', () => {
    // Under the D-14 defaults SAME_WORKFORCE_GROUP and ORGANIZATION_PEER hold IDENTITY only, so
    // an omitted leaveTypeName is the DEFAULT rendering for every peer, not an edge case. The
    // fixtures above always carried these keys, so nothing observed the fallbacks (code review
    // 2026-08-29). Keys are deleted, not nulled — the server omits them.
    const outToday = [{ ...mockOutToday[0] }] as Record<string, unknown>[]
    delete outToday[0].fullName
    delete outToday[0].initials
    delete outToday[0].leaveTypeName
    delete outToday[0].leaveTypeIcon
    const upcoming = [{ ...mockUpcoming[0] }] as Record<string, unknown>[]
    delete upcoming[0].fullName
    delete upcoming[0].leaveTypeIcon

    const { container } = renderSidebar(
      outToday as unknown as OutTodayResponse[],
      upcoming as unknown as UpcomingAbsenceResponse[],
    )

    expect(container.innerHTML).not.toContain('undefined')
    // The sub-line says detail is withheld rather than collapsing to a blank row.
    expect(screen.getByText('Details hidden')).toBeInTheDocument()
    expect(screen.getAllByText('A teammate')).toHaveLength(2)
    expect(screen.getAllByText('?')).toHaveLength(2)
    // A withheld icon drops its decorative span instead of rendering an empty one.
    expect(container.querySelector('.upcoming-icon')).toBeNull()
    // The assertions above pin the real English strings on purpose: i18next's
    // parseMissingKeyHandler returns '' here, so a typo'd key renders blank and would still
    // satisfy a presence-only check.
  })

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
