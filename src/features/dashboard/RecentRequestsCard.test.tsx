import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import i18n from '../../i18n/config'
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
  afterEach(async () => {
    cleanup()
    if (i18n.language !== 'en') {
      await i18n.changeLanguage('en')
    }
  })

  it('[P1] renders pending row with Waiting for approval hint', () => {
    renderCard()
    const row = screen.getByTestId('recent-request-row-1')
    expect(within(row).getByText('Waiting for approval')).toBeInTheDocument()
    expect(within(row).getByText('Pending')).toBeInTheDocument()
  })

  it('[P1] renders declined row with decline reason verbatim', () => {
    renderCard()
    const row = screen.getByTestId('recent-request-row-2')
    expect(
      within(row).getByText(
        '"Team needs in-office coverage for sprint review"',
      ),
    ).toBeInTheDocument()
  })

  it('[P1] renders approved row with approver first name hint', () => {
    renderCard()
    const row = screen.getByTestId('recent-request-row-3')
    expect(within(row).getByText('Approved by Alex')).toBeInTheDocument()
  })

  it('[P1] shows empty state when no requests', () => {
    renderCard([])
    expect(screen.getByText(/No leave requests yet/i)).toBeInTheDocument()
  })

  it('[P0] renders task-preserving mobile request cards with primary facts', () => {
    renderCard()

    const mobileCard = screen.getByTestId('recent-request-card-1')
    expect(mobileCard).toHaveTextContent('Annual Leave')
    expect(mobileCard).toHaveTextContent('Jun 10, 2026 – Jun 14, 2026')
    expect(mobileCard).toHaveTextContent('3 working days')
    expect(mobileCard).toHaveTextContent('Pending')
    expect(mobileCard).toHaveTextContent('Waiting for approval')
  })

  it('[P0] localizes structured hints instead of rendering server English in Arabic', async () => {
    await i18n.changeLanguage('ar')
    renderCard()

    const pendingRow = screen.getByTestId('recent-request-row-1')
    expect(pendingRow).toHaveTextContent('بانتظار الموافقة')
    expect(pendingRow).not.toHaveTextContent('Waiting for approval')

    const approvedRow = screen.getByTestId('recent-request-row-3')
    expect(approvedRow).toHaveTextContent('وافق عليه Alex')
    expect(approvedRow).not.toHaveTextContent('Approved by Alex')
  })
})
