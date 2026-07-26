import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import type {
  BalanceCardResponse,
  LeaveTypeResponse,
  PreviewLeaveRequestResponse,
  RecentRequestResponse,
  UserRole,
} from '../../api/generated/types'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { ToastProvider } from '../../components/ui/ToastProvider'
import i18n from '../../i18n/config'
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

function renderMyLeavesPage(
  initialPath = '/my-leaves',
  role: UserRole = 'EMPLOYEE',
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthTestProvider value={createMockAuthForRole(role)}>
            <MyLeavesPage />
          </AuthTestProvider>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
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
  afterEach(async () => {
    vi.restoreAllMocks()
    if (i18n.language !== 'en') {
      await act(() => i18n.changeLanguage('en'))
    }
  })

  it('[P1] announces balance and history loading via role=status', () => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockImplementation(
      () => new Promise(() => undefined),
    )
    vi.spyOn(apiClient, 'getMyLeaveRequests').mockImplementation(
      () => new Promise(() => undefined),
    )

    renderMyLeavesPage()

    expect(
      screen.getByRole('status', { name: /loading leave balances/i }),
    ).toHaveAttribute('aria-busy', 'true')
    expect(
      screen.getByRole('status', { name: /loading leave history/i }),
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('[P1] keeps balance and history errors adjacent and retries each region', async () => {
    vi.spyOn(apiClient, 'getDashboardBalances')
      .mockRejectedValueOnce(new Error('balances unavailable'))
      .mockResolvedValue(mockBalances)
    vi.spyOn(apiClient, 'getMyLeaveRequests')
      .mockRejectedValueOnce(new Error('history unavailable'))
      .mockResolvedValue(mockHistory)
    const user = userEvent.setup()

    renderMyLeavesPage()

    const balancesError = await screen.findByTestId('my-leaves-balances-error')
    const historyError = await screen.findByTestId('my-leaves-history-error')
    expect(within(balancesError).getByRole('alert')).toHaveTextContent(
      'Unable to load your leave balances',
    )
    expect(within(historyError).getByRole('alert')).toHaveTextContent(
      'Unable to load your leave history',
    )

    await user.click(within(balancesError).getByRole('button', { name: 'Retry' }))
    await user.click(within(historyError).getByRole('button', { name: 'Retry' }))

    expect(await screen.findByTestId('my-leaves-balance-grid')).toBeInTheDocument()
    expect(await screen.findByTestId('my-leaves-request-row-3')).toBeInTheDocument()
  })

  it('renders the page full-bleed (page-wide) like Settings', async () => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue(mockBalances)
    vi.spyOn(apiClient, 'getMyLeaveRequests').mockResolvedValue(mockHistory)

    renderMyLeavesPage()

    expect(screen.getByTestId('my-leaves-page')).toHaveClass('page', 'page-wide')
  })

  it('[P0] renders balances, stored-result explainer, filters, and history in task order', async () => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue(mockBalances)
    vi.spyOn(apiClient, 'getMyLeaveRequests').mockResolvedValue(mockHistory)

    renderMyLeavesPage()

    const balanceGrid = await screen.findByTestId('my-leaves-balance-grid')
    const explainer = screen.getByTestId('my-leaves-request-explainer')
    const filters = screen.getByTestId('my-leaves-status-filter')
    const historyTable = await screen.findByTestId('my-leaves-history-table')
    expect(balanceGrid.compareDocumentPosition(explainer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(explainer.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(filters.compareDocumentPosition(historyTable) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
    const historyRegion = screen.getByRole('region', { name: 'Leave History' })
    expect(historyRegion).toBe(screen.getByTestId('my-leaves-history-table'))
    expect(historyRegion).toHaveAttribute('tabindex', '0')
    expect(screen.getByTestId('my-leaves-request-row-3')).toHaveTextContent('Approved')
    expect(screen.getByTestId('my-leaves-request-row-2')).toHaveTextContent('Declined')
    expect(screen.getByTestId('my-leaves-request-row-1')).toHaveTextContent('Pending')
  })

  it('[P1] preserves the HR audit column while personal-history filters are active', async () => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue(mockBalances)
    vi.spyOn(apiClient, 'getMyLeaveRequests').mockResolvedValue(mockHistory)

    renderMyLeavesPage('/my-leaves?status=DECLINED', 'HR_ADMIN')

    const historyRegion = await screen.findByTestId('my-leaves-history-table')
    expect(within(historyRegion).getByRole('columnheader', { name: 'Audit' }))
      .toBeInTheDocument()
    expect(screen.getByTestId('audit-history-expander-2')).toBeInTheDocument()
    expect(screen.queryByTestId('my-leaves-request-row-1')).not.toBeInTheDocument()
  })

  it('[P1] shows status hints and declined reason verbatim', async () => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue(mockBalances)
    vi.spyOn(apiClient, 'getMyLeaveRequests').mockResolvedValue(mockHistory)

    renderMyLeavesPage()

    const pendingRow = await screen.findByTestId('my-leaves-request-row-1')
    expect(within(pendingRow).getByText('Waiting for approval')).toBeInTheDocument()

    const approvedRow = screen.getByTestId('my-leaves-request-row-3')
    expect(within(approvedRow).getByText('Approved by Alex')).toBeInTheDocument()

    const declinedRow = screen.getByTestId('my-leaves-request-row-2')
    expect(
      within(declinedRow).getByText(/Team needs in-office coverage for sprint review/),
    ).toBeInTheDocument()
  })

  it('[P0] exposes the same primary facts in task-preserving mobile cards', async () => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue(mockBalances)
    vi.spyOn(apiClient, 'getMyLeaveRequests').mockResolvedValue(mockHistory)

    renderMyLeavesPage()

    const mobileCard = await screen.findByTestId('my-leaves-request-card-2')
    expect(mobileCard).toHaveTextContent('Sick Leave')
    expect(mobileCard).toHaveTextContent('Jun 12, 2026')
    expect(mobileCard).toHaveTextContent('1 working day')
    expect(mobileCard).toHaveTextContent('Declined')
    expect(mobileCard).toHaveTextContent(
      'Team needs in-office coverage for sprint review',
    )
    expect(within(mobileCard).getByRole('button', { name: /Details for Sick Leave/i }))
      .toHaveAttribute('aria-expanded', 'false')
  })

  it('[P0] expands stored working-day context without inventing per-date evidence', async () => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue(mockBalances)
    vi.spyOn(apiClient, 'getMyLeaveRequests').mockResolvedValue(mockHistory)
    const user = userEvent.setup()

    renderMyLeavesPage()

    const row = await screen.findByTestId('my-leaves-request-row-2')
    await user.click(within(row).getByRole('button', { name: /Details for Sick Leave/i }))

    const details = await screen.findByTestId('my-leaves-request-details-2')
    expect(details).toHaveTextContent('1 working day')
    expect(details).toHaveTextContent('Workforce Group on your profile: US')
    expect(details).toHaveTextContent(
      'Individual charged and excluded dates were not returned',
    )
    expect(within(details).queryByTestId('working-day-chips')).not.toBeInTheDocument()
  })

  it('[P0] localizes structured status hints instead of rendering raw server English', async () => {
    await act(() => i18n.changeLanguage('ar'))
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue(mockBalances)
    vi.spyOn(apiClient, 'getMyLeaveRequests').mockResolvedValue(mockHistory)

    renderMyLeavesPage()

    const pendingRow = await screen.findByTestId('my-leaves-request-row-1')
    expect(pendingRow).toHaveTextContent('بانتظار الموافقة')
    expect(pendingRow).not.toHaveTextContent('Waiting for approval')

    const approvedRow = screen.getByTestId('my-leaves-request-row-3')
    expect(approvedRow).toHaveTextContent('وافق عليه Alex')
    expect(approvedRow).not.toHaveTextContent('Approved by Alex')
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
      expect(screen.getByTestId('app-toast')).toHaveTextContent(
        'Leave request submitted',
      )
      expect(historySpy).toHaveBeenCalledTimes(2)
      expect(balanceSpy).toHaveBeenCalledTimes(2)
    })
  })
})
