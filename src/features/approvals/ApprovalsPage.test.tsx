import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import type { PendingApprovalResponse, RecentApprovalDecisionResponse } from '../../api/generated/types'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { ToastProvider } from '../../components/ui/ToastProvider'
import { ApprovalsPage } from './ApprovalsPage'

const mockPendingApprovals: PendingApprovalResponse[] = [
  {
    requestId: 101,
    employeeUserId: 7,
    employeeFullName: 'Sarah Chen',
    leaveTypeId: 1,
    leaveTypeName: 'Annual Leave',
    leaveTypeIcon: 'leave',
    leaveTypeColor: '#093C5D',
    leaveTypeBackgroundColor: '#D6E8ED',
    leaveTypeBorderColor: '#0E4F75',
    dateFrom: '2026-06-15',
    dateTo: '2026-06-17',
    workingDays: 2,
    note: 'Family trip',
    workforceGroupName: 'US',
  },
]

const mockRecentDecisions: RecentApprovalDecisionResponse[] = [
  {
    requestId: 201,
    employeeUserId: 8,
    employeeFullName: 'Jamie Lee',
    leaveTypeId: 1,
    leaveTypeName: 'Annual Leave',
    leaveTypeIcon: 'leave',
    leaveTypeColor: '#093C5D',
    leaveTypeBackgroundColor: '#D6E8ED',
    leaveTypeBorderColor: '#0E4F75',
    dateFrom: '2026-05-01',
    dateTo: '2026-05-03',
    workingDays: 2,
    status: 'APPROVED',
    actorFirstName: 'Alex',
    decidedAt: '2026-05-02T10:00:00Z',
    decidedOnBehalf: false,
  },
]

function renderApprovalsPage(role: 'MANAGER' | 'HR_ADMIN' = 'MANAGER') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthTestProvider value={createMockAuthForRole(role)}>
            <ApprovalsPage />
          </AuthTestProvider>
        </ToastProvider>
      </QueryClientProvider>,
    ),
  }
}

describe('ApprovalsPage', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getRecentApprovalDecisions').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('[P1] announces pending and recent loading states via role=status', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockImplementation(
      () => new Promise(() => undefined),
    )
    vi.spyOn(apiClient, 'getRecentApprovalDecisions').mockImplementation(
      () => new Promise(() => undefined),
    )

    renderApprovalsPage('MANAGER')

    expect(
      screen.getByRole('status', { name: /loading pending requests/i }),
    ).toHaveAttribute('aria-busy', 'true')
    expect(
      screen.getByRole('status', { name: /loading recent decisions/i }),
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('renders the page full-bleed (page-wide) like Settings', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue(mockPendingApprovals)

    renderApprovalsPage('MANAGER')

    expect(screen.getByTestId('approvals-page')).toHaveClass('page', 'page-wide')
  })

  it('[P1] renders scoped pending approval rows with employee and leave details', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue(mockPendingApprovals)

    renderApprovalsPage('MANAGER')

    await waitFor(() => {
      expect(screen.getByTestId('approvals-pending-list')).toBeInTheDocument()
    })

    const row = screen.getByTestId('approval-row-101')
    expect(row).toBeInTheDocument()
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument()
    expect(row).toHaveTextContent('Annual Leave')
    expect(row).toHaveTextContent(/2 working day/)
    expect(row).toHaveTextContent(/Family trip/)
    expect(screen.getByTestId('approve-btn-101')).toBeInTheDocument()
    expect(screen.getByTestId('decline-btn-101')).toBeInTheDocument()
  })

  it('[P1] shows All caught up! empty state when inbox is empty', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue([])

    renderApprovalsPage('MANAGER')

    await waitFor(() => {
      expect(screen.getByTestId('approvals-empty-state')).toBeInTheDocument()
    })

    expect(screen.getByText('All caught up!')).toBeInTheDocument()
    expect(screen.queryByTestId('approval-row-101')).not.toBeInTheDocument()
  })

  it('[P1] shows HR Admin backstop subtitle copy', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue([])

    renderApprovalsPage('HR_ADMIN')

    await waitFor(() => {
      expect(screen.getByTestId('approvals-page')).toBeInTheDocument()
    })

    expect(
      screen.getByText(/Review all requests — you can approve on behalf of any manager/i),
    ).toBeInTheDocument()
  })

  it('[P1] approve fires mutation, shows success toast, and invalidates related queries', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue(mockPendingApprovals)
    const approveSpy = vi.spyOn(apiClient, 'approveLeaveRequest').mockResolvedValue({
      id: 101,
      leaveTypeId: 1,
      dateFrom: '2026-06-15',
      dateTo: '2026-06-17',
      days: 2,
      status: 'APPROVED',
    })

    const { queryClient } = renderApprovalsPage('MANAGER')
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const user = userEvent.setup()

    await waitFor(() => expect(screen.getByTestId('approve-btn-101')).toBeEnabled())
    await user.click(screen.getByTestId('approve-btn-101'))

    expect(approveSpy).toHaveBeenCalledWith(101)
    await waitFor(() =>
      expect(screen.getByTestId('app-toast')).toHaveTextContent(/approved/i),
    )

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]))
    expect(invalidatedKeys.some((k) => k.includes('approvals') && k.includes('pending'))).toBe(true)
    expect(invalidatedKeys.some((k) => k.includes('dashboard') && k.includes('balances'))).toBe(true)
    expect(invalidatedKeys.some((k) => k.includes('leave-requests'))).toBe(true)
  })

  it('[P1] decline opens the DeclineModal for the row', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue(mockPendingApprovals)

    renderApprovalsPage('MANAGER')
    const user = userEvent.setup()

    await waitFor(() => expect(screen.getByTestId('decline-btn-101')).toBeEnabled())
    await user.click(screen.getByTestId('decline-btn-101'))

    expect(screen.getByTestId('decline-modal')).toBeInTheDocument()
    expect(screen.getByTestId('decline-confirm-btn')).toBeDisabled()
  })

  it('[P1] renders the reports-to pill when HR views a backstop pending row', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue([
      {
        ...mockPendingApprovals[0],
        nominalManagerFirstName: 'Morgan',
      },
    ])

    renderApprovalsPage('HR_ADMIN')

    await waitFor(() => expect(screen.getByTestId('approval-row-101')).toBeInTheDocument())
    expect(screen.getByTestId('reports-to-pill-101')).toHaveTextContent(/Reports to Morgan/i)
    expect(screen.queryByTestId('on-behalf-pill-101')).not.toBeInTheDocument()
  })

  it('[P1] decline fires mutation, shows success toast, and invalidates related queries', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue(mockPendingApprovals)
    const declineSpy = vi.spyOn(apiClient, 'declineLeaveRequest').mockResolvedValue({
      id: 101,
      leaveTypeId: 1,
      dateFrom: '2026-06-15',
      dateTo: '2026-06-17',
      days: 2,
      status: 'DECLINED',
      declineReason: 'Coverage gap that week',
    })

    const { queryClient } = renderApprovalsPage('MANAGER')
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const user = userEvent.setup()

    await waitFor(() => expect(screen.getByTestId('decline-btn-101')).toBeEnabled())
    await user.click(screen.getByTestId('decline-btn-101'))
    await user.type(screen.getByTestId('decline-reason-input'), 'Coverage gap that week')
    await user.click(screen.getByTestId('decline-confirm-btn'))

    expect(declineSpy).toHaveBeenCalledWith(101, 'Coverage gap that week')
    await waitFor(() =>
      expect(screen.getByTestId('app-toast')).toHaveTextContent(/declined/i),
    )

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]))
    expect(invalidatedKeys.some((k) => k.includes('approvals') && k.includes('pending'))).toBe(true)
    expect(invalidatedKeys.some((k) => k.includes('dashboard') && k.includes('balances'))).toBe(true)
    expect(invalidatedKeys.some((k) => k.includes('leave-requests'))).toBe(true)
  })

  it('[P1] renders Recent Decisions table with status badges and empty state', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue([])
    vi.spyOn(apiClient, 'getRecentApprovalDecisions').mockResolvedValue(mockRecentDecisions)

    renderApprovalsPage('MANAGER')

    await waitFor(() => {
      expect(screen.getByTestId('recent-decisions-table')).toBeInTheDocument()
    })

    const recentDecisionsRegion = screen.getByRole('region', { name: 'Recent Decisions' })
    expect(recentDecisionsRegion).toHaveAttribute('tabindex', '0')

    expect(screen.getByTestId('recent-decision-row-201')).toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('Alex')).toBeInTheDocument()
  })

  it('[P1] shows Recent Decisions empty state without hiding pending queue', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue(mockPendingApprovals)

    renderApprovalsPage('MANAGER')

    await waitFor(() => {
      expect(screen.getByTestId('approvals-pending-list')).toBeInTheDocument()
    })

    expect(screen.getByTestId('recent-decisions-empty')).toBeInTheDocument()
  })

  it('[P1] shows on-behalf pill in Recent Decisions for HR backstop decisions', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue([])
    vi.spyOn(apiClient, 'getRecentApprovalDecisions').mockResolvedValue([
      {
        ...mockRecentDecisions[0],
        decidedOnBehalf: true,
        nominalManagerFirstName: 'Morgan',
        actorFirstName: 'Jordan',
      },
    ])

    renderApprovalsPage('HR_ADMIN')

    await waitFor(() => {
      expect(screen.getByTestId('recent-on-behalf-pill-201')).toBeInTheDocument()
    })

    expect(screen.getByTestId('recent-on-behalf-pill-201')).toHaveTextContent(/On behalf of Morgan/i)
  })

  it('[P1] approve invalidates pending count and recent decisions queries', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue(mockPendingApprovals)
    vi.spyOn(apiClient, 'approveLeaveRequest').mockResolvedValue({
      id: 101,
      leaveTypeId: 1,
      dateFrom: '2026-06-15',
      dateTo: '2026-06-17',
      days: 2,
      status: 'APPROVED',
    })

    const { queryClient } = renderApprovalsPage('MANAGER')
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const user = userEvent.setup()

    await waitFor(() => expect(screen.getByTestId('approve-btn-101')).toBeEnabled())
    await user.click(screen.getByTestId('approve-btn-101'))

    await waitFor(() =>
      expect(screen.getByTestId('app-toast')).toHaveTextContent(/approved/i),
    )

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]))
    expect(invalidatedKeys.some((k) => k.includes('pending-count'))).toBe(true)
    expect(invalidatedKeys.some((k) => k.includes('recent-decisions'))).toBe(true)
  })

  it('[P1] approve refetch clears pending row and adds Recent Decisions entry', async () => {
    const approvedDecision: RecentApprovalDecisionResponse = {
      requestId: 101,
      employeeUserId: 7,
      employeeFullName: 'Sarah Chen',
      leaveTypeId: 1,
      leaveTypeName: 'Annual Leave',
      leaveTypeIcon: 'leave',
      leaveTypeColor: '#093C5D',
      leaveTypeBackgroundColor: '#D6E8ED',
      leaveTypeBorderColor: '#0E4F75',
      dateFrom: '2026-06-15',
      dateTo: '2026-06-17',
      workingDays: 2,
      status: 'APPROVED',
      actorFirstName: 'Alex',
      decidedAt: '2026-06-21T10:00:00Z',
      decidedOnBehalf: false,
    }

    vi.spyOn(apiClient, 'getPendingApprovals')
      .mockResolvedValueOnce(mockPendingApprovals)
      .mockResolvedValue([])
    vi.spyOn(apiClient, 'getRecentApprovalDecisions')
      .mockResolvedValueOnce([])
      .mockResolvedValue([approvedDecision])
    vi.spyOn(apiClient, 'approveLeaveRequest').mockResolvedValue({
      id: 101,
      leaveTypeId: 1,
      dateFrom: '2026-06-15',
      dateTo: '2026-06-17',
      days: 2,
      status: 'APPROVED',
    })

    const user = userEvent.setup()
    renderApprovalsPage('MANAGER')

    await waitFor(() => expect(screen.getByTestId('approval-row-101')).toBeInTheDocument())
    await user.click(screen.getByTestId('approve-btn-101'))

    await waitFor(() =>
      expect(screen.getByTestId('app-toast')).toHaveTextContent(/approved/i),
    )
    await waitFor(() => {
      expect(screen.queryByTestId('approval-row-101')).not.toBeInTheDocument()
      expect(screen.getByTestId('recent-decision-row-101')).toBeInTheDocument()
    })
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('[P1] decline invalidates pending count and recent decisions queries', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue(mockPendingApprovals)
    vi.spyOn(apiClient, 'declineLeaveRequest').mockResolvedValue({
      id: 101,
      leaveTypeId: 1,
      dateFrom: '2026-06-15',
      dateTo: '2026-06-17',
      days: 2,
      status: 'DECLINED',
      declineReason: 'Coverage gap that week',
    })

    const { queryClient } = renderApprovalsPage('MANAGER')
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const user = userEvent.setup()

    await waitFor(() => expect(screen.getByTestId('decline-btn-101')).toBeEnabled())
    await user.click(screen.getByTestId('decline-btn-101'))
    await user.type(screen.getByTestId('decline-reason-input'), 'Coverage gap that week')
    await user.click(screen.getByTestId('decline-confirm-btn'))

    await waitFor(() =>
      expect(screen.getByTestId('app-toast')).toHaveTextContent(/declined/i),
    )

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]))
    expect(invalidatedKeys.some((k) => k.includes('pending-count'))).toBe(true)
    expect(invalidatedKeys.some((k) => k.includes('recent-decisions'))).toBe(true)
  })

  it('[P2] does not show audit history affordance for managers', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue([])
    vi.spyOn(apiClient, 'getRecentApprovalDecisions').mockResolvedValue(mockRecentDecisions)

    renderApprovalsPage('MANAGER')

    await waitFor(() => expect(screen.getByTestId('recent-decisions-table')).toBeInTheDocument())
    expect(screen.queryByText('Audit history')).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Audit' })).not.toBeInTheDocument()
  })

  it('[P2] shows audit history affordance for HR admins on recent decisions', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue([])
    vi.spyOn(apiClient, 'getRecentApprovalDecisions').mockResolvedValue(mockRecentDecisions)

    renderApprovalsPage('HR_ADMIN')

    await waitFor(() => expect(screen.getByTestId('recent-decisions-table')).toBeInTheDocument())
    expect(screen.getByRole('columnheader', { name: 'Audit' })).toBeInTheDocument()
    expect(screen.getByText('Audit history')).toBeInTheDocument()
  })
})
