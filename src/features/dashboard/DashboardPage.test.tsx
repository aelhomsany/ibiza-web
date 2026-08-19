import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import type {
  BalanceCardResponse,
  RecentRequestResponse,
  UpcomingAbsenceResponse,
} from '../../api/generated/types'
import { ToastProvider } from '../../components/ui/ToastProvider'
import i18n from '../../i18n/config'
import {
  AuthTestProvider,
  createMockAuthForRole,
} from '../../test/authTestUtils'
import { DashboardPage } from './DashboardPage'

const mockBalances: BalanceCardResponse[] = [
  {
    leaveTypeId: 1,
    name: 'Annual Leave',
    icon: '🌴',
    color: '#093C5D',
    backgroundColor: '#D6E8ED',
    borderColor: '#0E4F75',
    displayOrder: 1,
    capped: true,
    allocatedDays: 20,
    usedDays: 0,
    remainingDays: 20,
  },
  {
    leaveTypeId: 5,
    name: 'Unpaid Leave',
    icon: '💼',
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

const pendingRequest: RecentRequestResponse = {
  id: 44,
  leaveTypeId: 1,
  leaveTypeName: 'Annual Leave',
  leaveTypeIcon: '🌴',
  leaveTypeColor: '#093C5D',
  leaveTypeBackgroundColor: '#D6E8ED',
  leaveTypeBorderColor: '#0E4F75',
  dateFrom: '2099-08-10',
  dateTo: '2099-08-14',
  workingDays: 3,
  status: 'PENDING',
  statusHint: 'Waiting for approval',
  declineReason: null,
  approverFirstName: null,
}

const approvedRequest: RecentRequestResponse = {
  ...pendingRequest,
  id: 45,
  dateFrom: '2099-09-10',
  dateTo: '2099-09-12',
  workingDays: 2,
  status: 'APPROVED',
  statusHint: 'Approved by Alex',
  approverFirstName: 'Alex',
}

const declinedRequest: RecentRequestResponse = {
  ...pendingRequest,
  id: 46,
  status: 'DECLINED',
  statusHint: null,
  declineReason: 'Coverage is needed that week',
}

const approvedUpcoming: UpcomingAbsenceResponse = {
  id: approvedRequest.id,
  userId: 1,
  fullName: 'Test User',
  dateFrom: approvedRequest.dateFrom,
  workingDays: approvedRequest.workingDays,
  leaveTypeIcon: approvedRequest.leaveTypeIcon,
}

function renderDashboardPage(
  role: 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' = 'EMPLOYEE',
) {
  vi.mocked(apiClient.getApprovalCapability).mockResolvedValue({
    canReviewApprovals: role === 'MANAGER' || role === 'HR_ADMIN',
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <AuthTestProvider value={createMockAuthForRole(role)}>
              <DashboardPage />
            </AuthTestProvider>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    ),
  }
}

describe('DashboardPage — Story 11.2 hierarchy and prioritization', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getApprovalCapability').mockResolvedValue({
      canReviewApprovals: false,
    })
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue(mockBalances)
    vi.spyOn(apiClient, 'getDashboardRecentRequests').mockResolvedValue([])
    vi.spyOn(apiClient, 'getDashboardOutToday').mockResolvedValue([])
    vi.spyOn(apiClient, 'getDashboardUpcoming').mockResolvedValue([])
    vi.spyOn(apiClient, 'getPendingApprovalCount').mockResolvedValue({ count: 0 })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    cleanup()
    if (i18n.language !== 'en') {
      await i18n.changeLanguage('en')
    }
  })

  it('[P1] keeps the Dashboard full-bleed', async () => {
    renderDashboardPage()

    await screen.findByTestId('balance-grid')
    expect(screen.getByTestId('dashboard-page')).toHaveClass('page', 'page-wide')
  })

  it('[P0] orders value row before balances before supporting tier', async () => {
    renderDashboardPage()

    const valueRow = await screen.findByTestId('dashboard-value-row')
    const balanceGrid = await screen.findByTestId('balance-grid')
    const supportingTier = screen.getByTestId('dash-grid')

    expect(screen.getByTestId('balance-card-annual-leave')).toBeInTheDocument()
    expect(screen.getByTestId('balance-card-unpaid-leave')).toBeInTheDocument()
    expect(screen.getByTestId('recent-requests-card')).toBeInTheDocument()
    expect(screen.getByTestId('out-today-sidebar')).toBeInTheDocument()
    expect(
      valueRow.compareDocumentPosition(balanceGrid) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(
      balanceGrid.compareDocumentPosition(supportingTier) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('[P1] keeps other regions available when balance fetch fails', async () => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockRejectedValue(
      new Error('Network error'),
    )
    renderDashboardPage()

    await screen.findByTestId('dashboard-balances-error')
    expect(screen.getByTestId('dashboard-value-row')).toBeInTheDocument()
    expect(screen.getByTestId('dash-grid')).toBeInTheDocument()
    expect(screen.getByTestId('recent-requests-card')).toBeInTheDocument()
    expect(screen.getByTestId('out-today-sidebar')).toBeInTheDocument()
  })

  it('[P1] exposes a labelled region skeleton while balances load', () => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockReturnValue(
      new Promise(() => {}),
    )

    renderDashboardPage()

    expect(screen.getByTestId('balance-grid-loading')).toHaveAttribute(
      'aria-busy',
      'true',
    )
    expect(screen.getByTestId('balance-grid-loading')).toHaveAccessibleName(
      'Loading your leave balances…',
    )
  })

  it('[P0] opens Request Leave from the first header action', async () => {
    vi.spyOn(apiClient, 'getLeaveTypes').mockResolvedValue([])
    const user = userEvent.setup()
    renderDashboardPage()

    await screen.findByTestId('balance-grid')
    await user.click(screen.getByTestId('request-leave-btn'))

    expect(screen.getByTestId('request-leave-modal')).toBeInTheDocument()
  })

  it.each(['MANAGER', 'HR_ADMIN'] as const)(
    '[P0] prioritizes pending approvals for %s',
    async (role) => {
      vi.spyOn(apiClient, 'getPendingApprovalCount').mockResolvedValue({
        count: 3,
      })

      renderDashboardPage(role)

      await screen.findByText('3 pending approvals')
      const attention = screen.getByTestId('dashboard-attention')
      expect(attention).toHaveTextContent('3 pending approvals')
      expect(
        within(attention).getByRole('link', { name: 'Review Now' }),
      ).toHaveAttribute('href', '/approvals')
      expect(screen.getAllByTestId('dashboard-attention')).toHaveLength(1)

      const balanceRegion = await screen.findByTestId(
        'dashboard-balances-region',
      )
      const valueProof = screen.getByTestId('dashboard-value-proof')
      expect(
        attention.compareDocumentPosition(balanceRegion) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
      expect(
        attention.compareDocumentPosition(valueProof) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    },
  )

  it('[P0] shows an Employee request-status action and stored working-day result', async () => {
    vi.spyOn(apiClient, 'getDashboardRecentRequests').mockResolvedValue([
      pendingRequest,
    ])
    renderDashboardPage('EMPLOYEE')

    await screen.findByText('Request awaiting approval')
    const attention = screen.getByTestId('dashboard-attention')
    expect(attention).toHaveTextContent('Request awaiting approval')
    expect(attention).toHaveTextContent(
      'Annual Leave · Aug 10, 2099 – Aug 14, 2099. Waiting for approval',
    )
    expect(attention).not.toHaveTextContent('1 request awaiting approval')
    expect(
      within(attention).getByRole('link', { name: 'View My Leaves' }),
    ).toHaveAttribute('href', '/my-leaves')

    const valueProof = screen.getByTestId('dashboard-value-proof')
    expect(valueProof).toHaveTextContent('Stored result from your latest request')
    expect(within(valueProof).getByText('3 working days')).toBeInTheDocument()
    expect(valueProof).toHaveTextContent('Annual Leave')
    expect(valueProof).toHaveTextContent('Waiting for approval')
    expect(valueProof).toHaveTextContent('Policy source:')
    expect(
      within(valueProof).queryByText('How this is calculated'),
    ).not.toBeInTheDocument()
  })

  it('[P0] labels product education and renders a calm empty attention state', async () => {
    renderDashboardPage('EMPLOYEE')

    await screen.findByText('Nothing needs your attention')
    const attention = screen.getByTestId('dashboard-attention')
    expect(attention).toHaveTextContent('Nothing needs your attention')
    expect(
      within(attention).getByRole('button', { name: 'Request Leave' }),
    ).toBeInTheDocument()

    const valueProof = screen.getByTestId('dashboard-value-proof')
    expect(valueProof).toHaveTextContent('Working-day product guide')
    expect(valueProof).toHaveTextContent('Working days, counted clearly')
    expect(valueProof).toHaveTextContent(
      'Ibiza excludes weekends and holidays defined by your Workforce Group',
    )
  })

  it.each(['MANAGER', 'HR_ADMIN'] as const)(
    '[P0] falls through to the personal request status for %s when approvals are empty',
    async (role) => {
      vi.spyOn(apiClient, 'getDashboardRecentRequests').mockResolvedValue([
        declinedRequest,
      ])

      renderDashboardPage(role)

      await screen.findByText('A request needs your review')
      const attention = screen.getByTestId('dashboard-attention')
      expect(attention).toHaveTextContent('A request needs your review')
      expect(attention).toHaveTextContent('Coverage is needed that week')
      expect(
        within(attention).getByRole('link', { name: 'View My Leaves' }),
      ).toHaveAttribute('href', '/my-leaves')
    },
  )

  it('[P0] uses server-windowed upcoming data instead of the browser clock', async () => {
    vi.spyOn(apiClient, 'getDashboardRecentRequests').mockResolvedValue([
      approvedRequest,
    ])
    vi.spyOn(apiClient, 'getDashboardUpcoming').mockResolvedValue([
      approvedUpcoming,
    ])

    renderDashboardPage('EMPLOYEE')

    await screen.findByText('Your leave starts Sep 10, 2099')
    const attention = screen.getByTestId('dashboard-attention')
    expect(attention).toHaveTextContent('Your leave starts Sep 10, 2099')
    expect(attention).toHaveTextContent(
      'Annual Leave is approved for 2 working days.',
    )
  })

  it('[P0] localizes structured request status instead of rendering the English API hint', async () => {
    await i18n.changeLanguage('ar')
    vi.spyOn(apiClient, 'getDashboardRecentRequests').mockResolvedValue([
      pendingRequest,
    ])

    renderDashboardPage('EMPLOYEE')

    await screen.findByText('طلب بانتظار الموافقة')
    const attention = screen.getByTestId('dashboard-attention')
    expect(attention).toHaveTextContent('طلب بانتظار الموافقة')
    expect(attention).toHaveTextContent('بانتظار الموافقة')
    expect(attention).not.toHaveTextContent('Waiting for approval')
  })

  it('[P1] replaces approval priority with the calm state after a zero refetch', async () => {
    vi.spyOn(apiClient, 'getPendingApprovalCount')
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValue({ count: 0 })

    const { queryClient } = renderDashboardPage('MANAGER')

    expect(await screen.findByText('2 pending approvals')).toBeInTheDocument()
    await queryClient.invalidateQueries({
      queryKey: ['approvals', 'pending-count', 1],
    })

    await waitFor(() => {
      expect(
        screen.getByTestId('dashboard-attention'),
      ).toHaveTextContent('Nothing needs your attention')
    })
    expect(
      screen.queryByRole('link', { name: 'Review Now' }),
    ).not.toBeInTheDocument()
  })
})
