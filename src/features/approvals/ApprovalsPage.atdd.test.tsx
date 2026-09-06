import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { ToastProvider } from '../../components/ui/ToastProvider'
import { ApprovalsPage } from './ApprovalsPage'

type PendingApprovalResponse = {
  requestId: number
  employeeUserId: number
  employeeFullName: string
  leaveTypeId: number
  leaveTypeName: string
  leaveTypeIcon: string
  leaveTypeColor: string
  leaveTypeBackgroundColor: string
  leaveTypeBorderColor: string
  dateFrom: string
  dateTo: string
  workingDays: number
  note: string | null
  workforceGroupName?: string | null
}

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

type ApprovalsApiClient = typeof apiClient & {
  getPendingApprovals: () => Promise<PendingApprovalResponse[]>
}

function renderApprovalsPage(role: 'MANAGER' | 'ORGANIZATION_ADMIN' = 'MANAGER') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthTestProvider value={createMockAuthForRole(role)}>
          <ApprovalsPage />
        </AuthTestProvider>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('ApprovalsPage ATDD - Story 3.6', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.skip('[P1] renders scoped pending approval rows with employee and leave details', async () => {
    vi.spyOn(apiClient as ApprovalsApiClient, 'getPendingApprovals').mockResolvedValue(
      mockPendingApprovals,
    )

    renderApprovalsPage('MANAGER')

    await waitFor(() => {
      expect(screen.getByTestId('approvals-pending-list')).toBeInTheDocument()
    })

    expect(screen.getByTestId('approval-card-101')).toBeInTheDocument()
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument()
    expect(screen.getByText('Annual Leave')).toBeInTheDocument()
    expect(screen.getByText(/2 working day/)).toBeInTheDocument()
    expect(screen.getByText(/Family trip/)).toBeInTheDocument()
    expect(screen.getByTestId('approve-btn-101')).toBeInTheDocument()
    expect(screen.getByTestId('decline-btn-101')).toBeInTheDocument()
  })

  it.skip('[P1] shows All caught up! empty state when inbox is empty', async () => {
    vi.spyOn(apiClient as ApprovalsApiClient, 'getPendingApprovals').mockResolvedValue([])

    renderApprovalsPage('MANAGER')

    await waitFor(() => {
      expect(screen.getByTestId('approvals-empty-state')).toBeInTheDocument()
    })

    expect(screen.getByText('All caught up!')).toBeInTheDocument()
    expect(screen.queryByTestId('approval-card-101')).not.toBeInTheDocument()
  })

  it.skip('[P1] shows Organization Admin backstop subtitle copy', async () => {
    vi.spyOn(apiClient as ApprovalsApiClient, 'getPendingApprovals').mockResolvedValue([])

    renderApprovalsPage('ORGANIZATION_ADMIN')

    await waitFor(() => {
      expect(screen.getByTestId('approvals-page')).toBeInTheDocument()
    })

    expect(
      screen.getByText(/Review all requests — you can approve on behalf of any manager/i),
    ).toBeInTheDocument()
  })
})
