import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import type {
  BalanceCardResponse,
  LeaveTypeResponse,
  PreviewLeaveRequestResponse,
  RecentRequestResponse,
} from '../../api/generated/types'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { MyLeavesPage } from './MyLeavesPage'

const mockBalances: BalanceCardResponse[] = [
  {
    leaveTypeId: 1,
    name: 'Annual Leave',
    icon: 'leave',
    color: '#093C5D',
    backgroundColor: '#D6E8ED',
    borderColor: '#0E4F75',
    displayOrder: 1,
    capped: true,
    allocatedDays: 20,
    usedDays: 5,
    remainingDays: 15,
  },
  {
    leaveTypeId: 5,
    name: 'Unpaid Leave',
    icon: 'unpaid',
    color: '#5A7A80',
    backgroundColor: '#ECF4E8',
    borderColor: '#B8DCC4',
    displayOrder: 5,
    capped: false,
    allocatedDays: null,
    usedDays: 0,
    remainingDays: null,
  },
]

const mockHistory: RecentRequestResponse[] = [
  {
    id: 3,
    leaveTypeId: 1,
    leaveTypeName: 'Annual Leave',
    leaveTypeIcon: 'leave',
    leaveTypeColor: '#093C5D',
    leaveTypeBackgroundColor: '#D6E8ED',
    leaveTypeBorderColor: '#0E4F75',
    dateFrom: '2026-07-01',
    dateTo: '2026-07-05',
    workingDays: 3,
    status: 'APPROVED',
    statusHint: 'Approved by Alex',
    declineReason: null,
    approverFirstName: 'Alex',
  },
  {
    id: 2,
    leaveTypeId: 2,
    leaveTypeName: 'Sick Leave',
    leaveTypeIcon: 'sick',
    leaveTypeColor: '#991B1B',
    leaveTypeBackgroundColor: '#FEE2E2',
    leaveTypeBorderColor: '#FECACA',
    dateFrom: '2026-06-12',
    dateTo: '2026-06-12',
    workingDays: 1,
    status: 'DECLINED',
    statusHint: null,
    declineReason: 'Team needs in-office coverage for sprint review',
    approverFirstName: null,
  },
  {
    id: 1,
    leaveTypeId: 1,
    leaveTypeName: 'Annual Leave',
    leaveTypeIcon: 'leave',
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
]

const mockLeaveTypes: LeaveTypeResponse[] = [
  {
    id: 1,
    name: 'Annual Leave',
    icon: 'leave',
    color: '#093C5D',
    backgroundColor: '#D6E8ED',
    borderColor: '#0E4F75',
    defaultBalanceDays: 20,
    displayOrder: 1,
  },
]

const mockPreview: PreviewLeaveRequestResponse = {
  workingDays: 5,
  excludedWeekends: 2,
  excludedHolidays: 0,
  workforceGroupId: 1,
  workforceGroupName: 'US',
}

const mockCreateResponse = {
  id: 99,
  leaveTypeId: 1,
  dateFrom: '2026-08-03',
  dateTo: '2026-08-07',
  days: 5,
  status: 'PENDING' as const,
  note: null,
  createdAt: '2026-06-13T10:00:00Z',
}

function renderMyLeavesPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole('EMPLOYEE')}>
        <MyLeavesPage />
      </AuthTestProvider>
    </QueryClientProvider>,
  )
}

async function setLeaveDates(from: string, to: string) {
  fireEvent.change(screen.getByTestId('leave-from-date'), { target: { value: from } })
  fireEvent.change(screen.getByTestId('leave-to-date'), { target: { value: to } })
  await waitFor(() => {
    expect(screen.getByTestId('leave-from-date')).toHaveValue(from)
    expect(screen.getByTestId('leave-to-date')).toHaveValue(to)
  })
}

describe('MyLeavesPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the page full-bleed (page-wide) like Settings', async () => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue(mockBalances)
    vi.spyOn(apiClient, 'getMyLeaveRequests').mockResolvedValue(mockHistory)

    renderMyLeavesPage()

    expect(screen.getByTestId('my-leaves-page')).toHaveClass('page', 'page-wide')
  })

  it('[P1] balance grid precedes history table in document order', async () => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue(mockBalances)
    vi.spyOn(apiClient, 'getMyLeaveRequests').mockResolvedValue(mockHistory)

    renderMyLeavesPage()

    const balanceGrid = await screen.findByTestId('my-leaves-balance-grid')
    const historyTable = await screen.findByTestId('my-leaves-history-table')
    expect(balanceGrid.compareDocumentPosition(historyTable) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('[P1] renders mirrored balance grid and full personal history', async () => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue(mockBalances)
    vi.spyOn(apiClient, 'getMyLeaveRequests').mockResolvedValue(mockHistory)

    renderMyLeavesPage()

    await waitFor(() => {
      expect(screen.getByTestId('my-leaves-balance-grid')).toBeInTheDocument()
    })

    expect(screen.getByTestId('balance-card-annual-leave')).toBeInTheDocument()
    expect(screen.getByTestId('balance-card-unpaid-leave')).toBeInTheDocument()
    expect(screen.getByTestId('my-leaves-history-table')).toBeInTheDocument()
    expect(screen.getByTestId('my-leaves-request-row-3')).toHaveTextContent('Approved')
    expect(screen.getByTestId('my-leaves-request-row-2')).toHaveTextContent('Declined')
    expect(screen.getByTestId('my-leaves-request-row-1')).toHaveTextContent('Pending')
  })

  it('[P1] shows status hints and declined reason verbatim', async () => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue(mockBalances)
    vi.spyOn(apiClient, 'getMyLeaveRequests').mockResolvedValue(mockHistory)

    renderMyLeavesPage()

    await waitFor(() => {
      expect(screen.getByText('Waiting for approval')).toBeInTheDocument()
    })

    expect(screen.getByText('Approved by Alex')).toBeInTheDocument()
    expect(screen.getByText(/Team needs in-office coverage for sprint review/)).toBeInTheDocument()
  })

  it('[P1] shows empty state while keeping Request Leave CTA available', async () => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue(mockBalances)
    vi.spyOn(apiClient, 'getMyLeaveRequests').mockResolvedValue([])

    renderMyLeavesPage()

    await waitFor(() => {
      expect(screen.getByTestId('my-leaves-empty-state')).toBeInTheDocument()
    })

    expect(screen.getByText(/No leave requests yet/)).toBeInTheDocument()
    expect(screen.getByTestId('request-leave-btn')).toBeEnabled()
    expect(screen.queryByText('Leave history and balance grid ship in Story 3.5.')).not.toBeInTheDocument()
  })

  it('[P1] opens shared Request Leave modal from My Leaves', async () => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue(mockBalances)
    vi.spyOn(apiClient, 'getMyLeaveRequests').mockResolvedValue([])
    vi.spyOn(apiClient, 'getLeaveTypes').mockResolvedValue(mockLeaveTypes)
    const user = userEvent.setup()

    renderMyLeavesPage()

    await user.click(screen.getByTestId('request-leave-btn'))

    expect(screen.getByTestId('request-leave-modal')).toBeInTheDocument()
  })

  it('[P1] refreshes history and shows the existing toast after shared modal submit', async () => {
    const balanceSpy = vi
      .spyOn(apiClient, 'getDashboardBalances')
      .mockResolvedValue(mockBalances)
    const historySpy = vi
      .spyOn(apiClient, 'getMyLeaveRequests')
      .mockResolvedValueOnce([])
      .mockResolvedValue(mockHistory)
    vi.spyOn(apiClient, 'getLeaveTypes').mockResolvedValue(mockLeaveTypes)
    vi.spyOn(apiClient, 'previewLeaveRequest').mockResolvedValue(mockPreview)
    vi.spyOn(apiClient, 'createLeaveRequest').mockResolvedValue(mockCreateResponse)
    const user = userEvent.setup()

    renderMyLeavesPage()

    await waitFor(() => {
      expect(screen.getByTestId('my-leaves-empty-state')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('request-leave-btn'))
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Annual Leave/i })).toBeInTheDocument()
    })
    await user.selectOptions(screen.getByLabelText(/Leave Type/i), '1')
    await setLeaveDates('2026-08-03', '2026-08-07')
    await waitFor(() => expect(screen.getByTestId('submit-request-btn')).toBeEnabled())
    await user.click(screen.getByTestId('submit-request-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('submit-success-toast')).toHaveTextContent(
        'Leave request submitted',
      )
      expect(historySpy).toHaveBeenCalledTimes(2)
      expect(balanceSpy).toHaveBeenCalledTimes(2)
    })
  })
})
