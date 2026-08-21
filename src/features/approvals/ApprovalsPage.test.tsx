import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isolate } from '../../i18n/bidi'
import { act, render, screen, waitFor, within } from '@testing-library/react'
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
    overlappingApprovedAbsences: 0,
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
    vi.spyOn(apiClient, 'getDashboardOutToday').mockResolvedValue([])
    vi.spyOn(apiClient, 'getDashboardUpcoming').mockResolvedValue([])
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

    const row = screen.getByTestId('approval-card-101')
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
    expect(screen.queryByTestId('approval-card-101')).not.toBeInTheDocument()
  })

  it('[P1] shows HR Admin backstop subtitle copy', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue([])

    renderApprovalsPage('HR_ADMIN')

    await waitFor(() => {
      expect(screen.getByTestId('approvals-page')).toBeInTheDocument()
    })

    expect(
      screen.getByText(/Review organization approval requests and act on behalf when needed/i),
    ).toBeInTheDocument()
  })

  it('[P1] approve fires mutation, shows durable success feedback, and invalidates related queries', async () => {
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

    expect(approveSpy).toHaveBeenCalledWith(101, 1)
    await waitFor(() =>
      expect(screen.getByTestId('approvals-decision-feedback')).toHaveTextContent(/approved/i),
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

  it('[P0] level-two reviewer records a required concern and advances the queue', async () => {
    const levelTwoApproval: PendingApprovalResponse = {
      ...mockPendingApprovals[0],
      approvalLevel: 2,
      approvalEvidence: [],
    }
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue([levelTwoApproval])
    const concernSpy = vi.spyOn(apiClient, 'recordApprovalConcern').mockResolvedValue({
      id: 101,
      leaveTypeId: 1,
      dateFrom: '2026-06-15',
      dateTo: '2026-06-17',
      days: 2,
      status: 'APPROVED',
    })
    const user = userEvent.setup()

    renderApprovalsPage('MANAGER')

    await user.click(await screen.findByTestId('concern-btn-101'))
    const dialog = screen.getByRole('dialog', { name: /record project concern/i })
    const confirm = within(dialog).getByRole('button', { name: /record concern/i })
    expect(confirm).toBeDisabled()

    await user.type(within(dialog).getByLabelText(/concern note/i), 'Project coverage discussed')
    await user.click(confirm)

    expect(concernSpy).toHaveBeenCalledWith(101, 'Project coverage discussed', 2)
    await waitFor(() => {
      expect(screen.getByTestId('approvals-decision-feedback')).toHaveTextContent(/concern recorded/i)
    })
  })

  it('[P1] identifies the assigned approver when HR acts on a pending row', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue([
      {
        ...mockPendingApprovals[0],
        nominalApproverFirstName: 'Morgan',
      },
    ])

    renderApprovalsPage('HR_ADMIN')

    await waitFor(() => expect(screen.getByTestId('approval-card-101')).toBeInTheDocument())
    expect(screen.getByTestId('assigned-approver-pill-101')).toHaveTextContent(
      `Assigned approver: ${isolate('Morgan')}`,
    )
    expect(screen.getByTestId('on-behalf-notice-101')).toHaveTextContent(
      `acting on behalf of assigned approver ${isolate('Morgan')}`,
    )
    expect(screen.queryByTestId('on-behalf-pill-101')).not.toBeInTheDocument()
  })

  it('[P1] retains stale request context and disables its actions after a 409 conflict', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue(mockPendingApprovals)
    vi.spyOn(apiClient, 'approveLeaveRequest').mockRejectedValue(
      new apiClient.ApiError(409, {
        status: 409,
        detail: 'Leave request was already decided',
      }),
    )
    const user = userEvent.setup()

    renderApprovalsPage('MANAGER')
    await user.click(await screen.findByTestId('approve-btn-101'))

    expect(await screen.findByTestId('approval-card-101')).toHaveTextContent(
      /no longer actionable/i,
    )
    expect(screen.getByTestId('approve-btn-101')).toBeDisabled()
    expect(screen.getByTestId('decline-btn-101')).toBeDisabled()
    expect(screen.getByTestId('approvals-decision-feedback')).toHaveAttribute(
      'role',
      'alert',
    )
  })

  it('[P1] decline fires mutation, shows durable success feedback, and invalidates related queries', async () => {
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

    expect(declineSpy).toHaveBeenCalledWith(101, 'Coverage gap that week', 1)
    await waitFor(() =>
      expect(screen.getByTestId('approvals-decision-feedback')).toHaveTextContent(/declined/i),
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
        nominalApproverFirstName: 'Morgan',
        actorFirstName: 'Jordan',
      },
    ])

    renderApprovalsPage('HR_ADMIN')

    await waitFor(() => {
      expect(screen.getByTestId('recent-on-behalf-pill-201')).toBeInTheDocument()
    })

    expect(screen.getByTestId('recent-on-behalf-pill-201')).toHaveTextContent(
      /On behalf of assigned approver Morgan/i,
    )
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
      expect(screen.getByTestId('approvals-decision-feedback')).toHaveTextContent(/approved/i),
    )

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]))
    expect(invalidatedKeys.some((k) => k.includes('pending-count'))).toBe(true)
    expect(invalidatedKeys.some((k) => k.includes('recent-decisions'))).toBe(true)
  })

  it('[P0] keeps the same request visible when it advances to the next approval level', async () => {
    const levelOne = { ...mockPendingApprovals[0], approvalLevel: 1 }
    const levelTwo = {
      ...mockPendingApprovals[0],
      approvalLevel: 2,
      approvalEvidence: [],
    }
    vi.spyOn(apiClient, 'getPendingApprovals')
      .mockResolvedValueOnce([levelOne])
      .mockResolvedValue([levelTwo])
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
    await user.click(await screen.findByTestId('approve-btn-101'))

    await waitFor(() => {
      expect(screen.getByTestId('approval-card-101')).toHaveTextContent(
        /Current approval: level 2/i,
      )
    })
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

    await waitFor(() => expect(screen.getByTestId('approval-card-101')).toBeInTheDocument())
    await user.click(screen.getByTestId('approve-btn-101'))

    await waitFor(() =>
      expect(screen.getByTestId('approvals-decision-feedback')).toHaveTextContent(/approved/i),
    )
    await waitFor(() => {
      expect(screen.queryByTestId('approval-card-101')).not.toBeInTheDocument()
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
      expect(screen.getByTestId('approvals-decision-feedback')).toHaveTextContent(/declined/i),
    )

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]))
    expect(invalidatedKeys.some((k) => k.includes('pending-count'))).toBe(true)
    expect(invalidatedKeys.some((k) => k.includes('recent-decisions'))).toBe(true)
  })

  // APPROVAL-VAL-022 (P0, SPA-only): in-flight decision state is keyed by
  // (requestId, approvalLevel). Starting a second decision must not hand the first
  // card back to the approver mid-flight (Story 11.4 AC6 duplicate-submit guarantee).
  it('[P0] keeps the first card busy while a second decision starts', async () => {
    const secondApproval: PendingApprovalResponse = {
      ...mockPendingApprovals[0],
      requestId: 102,
      employeeUserId: 8,
      employeeFullName: 'Jamie Lee',
    }
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue([
      mockPendingApprovals[0],
      secondApproval,
    ])

    const resolvers = new Map<number, (value: never) => void>()
    const approveSpy = vi
      .spyOn(apiClient, 'approveLeaveRequest')
      .mockImplementation(
        (id: number) =>
          new Promise((resolve) => {
            resolvers.set(id, resolve as (value: never) => void)
          }),
      )
    const user = userEvent.setup()

    renderApprovalsPage('MANAGER')

    await waitFor(() => expect(screen.getByTestId('approve-btn-101')).toBeEnabled())

    // Two clicks inside one tick, before React can re-render the button as disabled.
    // This is the only path that actually reaches the `beginDecision` re-entrancy
    // guard: every UI entry point is `disabled` once the card is busy, so clicking a
    // busy button dispatches nothing and would assert the guard vacuously. If
    // `beginDecision` stopped refusing, the second click would fire a second mutation.
    await act(async () => {
      const approveFirst = screen.getByTestId('approve-btn-101')
      approveFirst.click()
      approveFirst.click()
    })
    expect(approveSpy.mock.calls.filter(([id]) => id === 101)).toHaveLength(1)

    await waitFor(() =>
      expect(screen.getByTestId('approve-btn-101')).toHaveAttribute('data-busy', 'true'),
    )

    await user.click(screen.getByTestId('approve-btn-102'))
    await waitFor(() =>
      expect(screen.getByTestId('approve-btn-102')).toHaveAttribute('data-busy', 'true'),
    )

    // The second decision must not re-enable the first card's actions.
    expect(screen.getByTestId('approve-btn-101')).toHaveAttribute('data-busy', 'true')
    expect(screen.getByTestId('approve-btn-101')).toBeDisabled()
    expect(screen.getByTestId('decline-btn-101')).toBeDisabled()

    // Settling the first decision releases only its own key.
    await act(async () => {
      resolvers.get(101)?.({ id: 101, status: 'APPROVED' } as never)
    })
    await waitFor(() =>
      expect(screen.queryByTestId('approval-card-101')).not.toBeInTheDocument(),
    )
    expect(screen.getByTestId('approve-btn-102')).toHaveAttribute('data-busy', 'true')

    await act(async () => {
      resolvers.get(102)?.({ id: 102, status: 'APPROVED' } as never)
    })
  })

  // APPROVAL-VAL-016 (P0): the page must hand the server's coverage fact to the card.
  // Nothing asserted this wiring, and because the fixture omitted the field every
  // page test rendered the "unavailable" fallback — so ApprovalsPage could stop
  // passing `overlappingApprovedAbsences` entirely and the suite stayed green.
  // Missing i18n keys resolve to an empty string in this app (i18n/config.ts
  // parseMissingKeyHandler), so this asserts the real sentence rather than presence.
  it('[P0] renders the server-supplied overlap count on the card', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue([
      { ...mockPendingApprovals[0], overlappingApprovedAbsences: 2 },
    ])

    renderApprovalsPage('MANAGER')

    const region = await screen.findByTestId('approval-coverage-101')
    expect(region).toHaveTextContent(
      '2 colleagues are away during this range.',
    )
    expect(region).not.toHaveTextContent('Some coverage facts are unavailable.')
  })

  // APPROVAL-VAL-032/033 (P0): decline and concern in-flight state moved off the shared
  // mutation's `isPending` onto the keyed map. Both page tests resolved immediately, so
  // no test observed either mid-flight — a wrong-kind lookup would leave the confirm
  // enabled and the modal dismissable during the request with nothing failing.
  it('[P0] keeps the decline modal and card busy while the decline is in flight', async () => {
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue([mockPendingApprovals[0]])
    let releaseDecline: (value: never) => void = () => undefined
    vi.spyOn(apiClient, 'declineLeaveRequest').mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseDecline = resolve as (value: never) => void
        }),
    )
    const user = userEvent.setup()

    renderApprovalsPage('MANAGER')

    await user.click(await screen.findByTestId('decline-btn-101'))
    await user.type(screen.getByTestId('decline-reason-input'), 'Coverage too thin')
    await user.click(screen.getByTestId('decline-confirm-btn'))

    await waitFor(() =>
      expect(screen.getByTestId('decline-confirm-btn')).toHaveAttribute('data-busy', 'true'),
    )
    expect(screen.getByTestId('decline-confirm-btn')).toBeDisabled()
    expect(screen.getByTestId('decline-cancel-btn')).toBeDisabled()
    expect(screen.getByTestId('decline-btn-101')).toHaveAttribute('data-busy', 'true')

    await act(async () => {
      releaseDecline({ id: 101, status: 'DECLINED' } as never)
    })
  })

  it('[P0] keeps the concern modal and card busy while the concern is in flight', async () => {
    const levelTwoApproval: PendingApprovalResponse = {
      ...mockPendingApprovals[0],
      approvalLevel: 2,
      approvalEvidence: [],
    }
    vi.spyOn(apiClient, 'getPendingApprovals').mockResolvedValue([levelTwoApproval])
    let releaseConcern: (value: never) => void = () => undefined
    vi.spyOn(apiClient, 'recordApprovalConcern').mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseConcern = resolve as (value: never) => void
        }),
    )
    const user = userEvent.setup()

    renderApprovalsPage('MANAGER')

    await user.click(await screen.findByTestId('concern-btn-101'))
    const dialog = screen.getByRole('dialog', { name: /record project concern/i })
    await user.type(within(dialog).getByLabelText(/concern note/i), 'Coverage discussed')
    await user.click(within(dialog).getByRole('button', { name: /record concern/i }))

    await waitFor(() =>
      expect(screen.getByTestId('concern-btn-101')).toHaveAttribute('data-busy', 'true'),
    )
    expect(within(dialog).getByRole('button', { name: /record concern/i })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: /cancel/i })).toBeDisabled()

    await act(async () => {
      releaseConcern({ id: 101, status: 'APPROVED' } as never)
    })
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
