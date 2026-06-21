import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import type { BalanceCardResponse } from '../../api/generated/types'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
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

function renderDashboardPage(role: 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' = 'EMPLOYEE') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthTestProvider value={createMockAuthForRole(role)}>
            <DashboardPage />
          </AuthTestProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue(mockBalances)
    vi.spyOn(apiClient, 'getDashboardRecentRequests').mockResolvedValue([])
    vi.spyOn(apiClient, 'getDashboardOutToday').mockResolvedValue([])
    vi.spyOn(apiClient, 'getDashboardUpcoming').mockResolvedValue([])
    vi.spyOn(apiClient, 'getPendingApprovalCount').mockResolvedValue({ count: 0 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders balance grid above dash grid', async () => {
    renderDashboardPage()

    await waitFor(() => {
      expect(screen.getByTestId('balance-grid')).toBeInTheDocument()
    })

    expect(screen.getByTestId('balance-card-annual-leave')).toBeInTheDocument()
    expect(screen.getByTestId('balance-card-unpaid-leave')).toBeInTheDocument()
    expect(screen.getByTestId('dash-grid')).toBeInTheDocument()
    expect(screen.getByTestId('recent-requests-card')).toBeInTheDocument()
    expect(screen.getByTestId('out-today-sidebar')).toBeInTheDocument()

    const grid = screen.getByTestId('balance-grid')
    const dashGrid = screen.getByTestId('dash-grid')
    // balance-grid must appear before dash-grid in document order
    expect(grid.compareDocumentPosition(dashGrid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders dash-grid even when balance fetch fails', async () => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockRejectedValue(new Error('Network error'))
    renderDashboardPage()

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-balances-error')).toBeInTheDocument()
    })

    expect(screen.getByTestId('dash-grid')).toBeInTheDocument()
    expect(screen.getByTestId('recent-requests-card')).toBeInTheDocument()
    expect(screen.getByTestId('out-today-sidebar')).toBeInTheDocument()
  })

  it('shows loading skeleton while balances fetch', () => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockReturnValue(new Promise(() => {}))

    renderDashboardPage()

    expect(screen.getByTestId('balance-grid-loading')).toBeInTheDocument()
  })

  it('opens request leave modal when CTA is clicked', async () => {
    vi.spyOn(apiClient, 'getLeaveTypes').mockResolvedValue([])
    const user = userEvent.setup()

    renderDashboardPage()

    await waitFor(() => {
      expect(screen.getByTestId('balance-grid')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('request-leave-btn'))
    expect(screen.getByTestId('request-leave-modal')).toBeInTheDocument()
  })

  it('[P1] renders pending alert above balance grid for Manager when count > 0', async () => {
    vi.spyOn(apiClient, 'getPendingApprovalCount').mockResolvedValue({ count: 3 })

    renderDashboardPage('MANAGER')

    const alert = await screen.findByTestId('dashboard-pending-alert')
    expect(alert).toHaveTextContent('3 Pending Approvals')
    expect(screen.getByRole('link', { name: 'Review Now' })).toHaveAttribute('href', '/approvals')

    const balanceGrid = await screen.findByTestId('balance-grid')
    expect(alert.compareDocumentPosition(balanceGrid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('[P1] hides pending alert when count is zero or user is Employee', async () => {
    renderDashboardPage('EMPLOYEE')

    await waitFor(() => {
      expect(screen.getByTestId('balance-grid')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('dashboard-pending-alert')).not.toBeInTheDocument()
  })

  it('[P1] hides pending alert after pending-count refetch returns zero', async () => {
    vi.spyOn(apiClient, 'getPendingApprovalCount')
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValue({ count: 0 })

    const { queryClient } = renderDashboardPage('MANAGER')

    await screen.findByTestId('dashboard-pending-alert')
    await queryClient.invalidateQueries({ queryKey: ['approvals', 'pending-count', 1] })

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-pending-alert')).not.toBeInTheDocument()
    })
  })
})

describe('DashboardPage — Story 3.2 dash grid', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue(mockBalances)
    vi.spyOn(apiClient, 'getDashboardRecentRequests').mockResolvedValue([])
    vi.spyOn(apiClient, 'getDashboardOutToday').mockResolvedValue([])
    vi.spyOn(apiClient, 'getDashboardUpcoming').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('[P1] renders dash-grid below balance grid without coming-soon placeholder', async () => {
    renderDashboardPage()

    await waitFor(() => {
      expect(screen.getByTestId('balance-grid')).toBeInTheDocument()
    })

    expect(screen.getByTestId('dash-grid')).toBeInTheDocument()
    expect(screen.getByTestId('recent-requests-card')).toBeInTheDocument()
    expect(screen.getByTestId('out-today-sidebar')).toBeInTheDocument()
    expect(screen.queryByText('Recent requests coming soon.')).not.toBeInTheDocument()
  })
})
