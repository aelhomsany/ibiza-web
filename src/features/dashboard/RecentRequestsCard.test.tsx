import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import type { RecentRequestResponse } from '../../api/generated/types'
import { RecentRequestsCard } from './RecentRequestsCard'

const mockRecentRequests: RecentRequestResponse[] = [
  {
    id: 1,
    leaveTypeId: 1,
    leaveTypeName: 'Annual Leave',
    leaveTypeIcon: '🌴',
    leaveTypeColor: '#093C5D',
    leaveTypeBackgroundColor: '#D6E8ED',
    leaveTypeBorderColor: '#0E4F75',
    dateFrom: '2026-06-10',
    dateTo: '2026-06-14',
    workingDays: 3,
    status: 'PENDING',
    statusHint: 'Waiting for approval',
    declineReason: null,
    approverFirstName: null,
  },
  {
    id: 2,
    leaveTypeId: 2,
    leaveTypeName: 'Sick Leave',
    leaveTypeIcon: '🤒',
    leaveTypeColor: '#EF4444',
    leaveTypeBackgroundColor: '#FEF2F2',
    leaveTypeBorderColor: '#FECACA',
    dateFrom: '2026-05-20',
    dateTo: '2026-05-20',
    workingDays: 1,
    status: 'DECLINED',
    statusHint: null,
    declineReason: 'Team needs in-office coverage for sprint review',
    approverFirstName: null,
  },
  {
    id: 3,
    leaveTypeId: 1,
    leaveTypeName: 'Annual Leave',
    leaveTypeIcon: '🌴',
    leaveTypeColor: '#093C5D',
    leaveTypeBackgroundColor: '#D6E8ED',
    leaveTypeBorderColor: '#0E4F75',
    dateFrom: '2026-07-01',
    dateTo: '2026-07-05',
    workingDays: 2,
    status: 'APPROVED',
    statusHint: 'Approved by Alex',
    declineReason: null,
    approverFirstName: 'Alex',
  },
]

function renderCard(requests = mockRecentRequests) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole('EMPLOYEE')}>
        <RecentRequestsCard requests={requests} />
      </AuthTestProvider>
    </QueryClientProvider>,
  )
}

describe('RecentRequestsCard — Story 3.2', () => {
  it('[P1] renders pending row with Waiting for approval hint', () => {
    renderCard()
    expect(screen.getByText('Waiting for approval')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('[P1] renders declined row with decline reason verbatim', () => {
    renderCard()
    expect(
      screen.getByText('"Team needs in-office coverage for sprint review"'),
    ).toBeInTheDocument()
  })

  it('[P1] renders approved row with approver first name hint', () => {
    renderCard()
    expect(screen.getByText('Approved by Alex')).toBeInTheDocument()
  })

  it('[P1] shows empty state when no requests', () => {
    renderCard([])
    expect(screen.getByText(/No leave requests yet/i)).toBeInTheDocument()
  })
})
