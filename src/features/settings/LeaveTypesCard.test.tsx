import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import type { LeaveTypeResponse } from '../../api/generated/types'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { LeaveTypesCard } from './LeaveTypesCard'

const mockLeaveTypes: LeaveTypeResponse[] = [
  {
    id: 1,
    name: 'Annual Leave',
    icon: '🏖️',
    color: '#093C5D',
    backgroundColor: '#D6E8ED',
    borderColor: '#0E4F75',
    defaultBalanceDays: 20,
    displayOrder: 1,
  },
  {
    id: 2,
    name: 'Sick Leave',
    icon: '🤒',
    color: '#EF4444',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    defaultBalanceDays: 10,
    displayOrder: 2,
  },
  {
    id: 3,
    name: 'Work From Home',
    icon: '🏠',
    color: '#2D6A4F',
    backgroundColor: '#E4F5DC',
    borderColor: '#CBF3BB',
    defaultBalanceDays: 30,
    displayOrder: 3,
  },
  {
    id: 4,
    name: 'Maternity/Paternity',
    icon: '👶',
    color: '#854D0E',
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE68A',
    defaultBalanceDays: 90,
    displayOrder: 4,
  },
  {
    id: 5,
    name: 'Unpaid Leave',
    icon: '📋',
    color: '#5A7A80',
    backgroundColor: '#ECF4E8',
    borderColor: '#B8DCC4',
    defaultBalanceDays: null,
    displayOrder: 5,
  },
]

function renderLeaveTypesCard(onWarning = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole('HR_ADMIN')}>
        <LeaveTypesCard onWarning={onWarning} />
      </AuthTestProvider>
    </QueryClientProvider>,
  )
}

describe('LeaveTypesCard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading state while leave types fetch', () => {
    vi.spyOn(apiClient, 'getLeaveTypes').mockImplementation(() => new Promise(() => {}))

    renderLeaveTypesCard()

    expect(screen.getByTestId('leave-types-card')).toBeInTheDocument()
    expect(screen.getByText('Loading leave types…')).toBeInTheDocument()
  })

  it('renders five leave types with capped and uncapped copy', async () => {
    vi.spyOn(apiClient, 'getLeaveTypes').mockResolvedValue(mockLeaveTypes)

    renderLeaveTypesCard()

    await waitFor(() => {
      expect(screen.getByTestId('leave-types-list')).toBeInTheDocument()
    })

    expect(screen.getByText('Annual Leave')).toBeInTheDocument()
    expect(screen.getByText('20 days default')).toBeInTheDocument()
    expect(screen.getByText('Sick Leave')).toBeInTheDocument()
    expect(screen.getByText('10 days default')).toBeInTheDocument()
    expect(screen.getByText('Unpaid Leave')).toBeInTheDocument()
    expect(screen.getByText('Unlimited / custom')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^leave-type-row-/)).toHaveLength(5)
  })

  it('calls onWarning when leave types fail to load', async () => {
    const onWarning = vi.fn()
    vi.spyOn(apiClient, 'getLeaveTypes').mockRejectedValue(new Error('fail'))

    renderLeaveTypesCard(onWarning)

    await waitFor(() => {
      expect(onWarning).toHaveBeenCalledWith('Unable to load leave types')
    })
  })
})
