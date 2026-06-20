import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import type { PreviewLeaveRequestResponse } from '../../api/generated/types'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { RequestLeaveModal } from './RequestLeaveModal'

const mockLeaveTypes = [
  {
    id: 1,
    name: 'Annual Leave',
    icon: '🌴',
    color: '#093C5D',
    backgroundColor: '#D6E8ED',
    borderColor: '#0E4F75',
    defaultBalanceDays: 20,
    displayOrder: 1,
  },
]

const mockPreviewFiveDays: PreviewLeaveRequestResponse = {
  workingDays: 5,
  excludedWeekends: 2,
  excludedHolidays: 0,
  workforceGroupId: 1,
  workforceGroupName: 'US',
}

const mockPreviewZeroDays: PreviewLeaveRequestResponse = {
  workingDays: 0,
  excludedWeekends: 2,
  excludedHolidays: 0,
  workforceGroupId: 1,
  workforceGroupName: 'US',
}

function renderModal(open = true, onClose = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole('EMPLOYEE')}>
        <RequestLeaveModal open={open} onClose={onClose} />
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

describe('RequestLeaveModal — Story 3.3', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getLeaveTypes').mockResolvedValue(mockLeaveTypes)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('[P0] disables submit and shows alert when preview returns zero working days', async () => {
    vi.spyOn(apiClient, 'previewLeaveRequest').mockResolvedValue(mockPreviewZeroDays)
    const user = userEvent.setup()

    renderModal()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Annual Leave/i })).toBeInTheDocument()
    })
    await user.selectOptions(screen.getByLabelText(/Leave Type/i), '1')
    await setLeaveDates('2026-06-06', '2026-06-07')

    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toHaveTextContent(/No working days/i)
      },
      { timeout: 2000 },
    )

    expect(screen.getByTestId('submit-request-btn')).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(/US Workforce Group/i)
  })

  it('[P1] renders charged-day preview copy and workforce group context', async () => {
    vi.spyOn(apiClient, 'previewLeaveRequest').mockResolvedValue(mockPreviewFiveDays)
    const user = userEvent.setup()

    renderModal()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Annual Leave/i })).toBeInTheDocument()
    })
    await user.selectOptions(screen.getByLabelText(/Leave Type/i), '1')
    await setLeaveDates('2026-06-01', '2026-06-07')

    await waitFor(
      () => {
        expect(screen.getByTestId('working-day-preview')).toHaveTextContent(/5 working days will be charged/i)
      },
      { timeout: 2000 },
    )

    expect(screen.getByText(/Based on US Workforce Group weekends & holidays/i)).toBeInTheDocument()
    expect(screen.getByText(/2 weekend\/holiday days excluded from balance/i)).toBeInTheDocument()
    expect(screen.getByTestId('submit-request-btn')).toBeEnabled()
  })
})

describe('RequestLeaveModal — Story 3.4', () => {
  const mockCreateResponse = {
    id: 99,
    leaveTypeId: 1,
    dateFrom: '2026-06-01',
    dateTo: '2026-06-05',
    days: 5,
    status: 'PENDING' as const,
    note: null,
    createdAt: '2026-06-13T10:00:00Z',
  }

  beforeEach(() => {
    vi.spyOn(apiClient, 'getLeaveTypes').mockResolvedValue(mockLeaveTypes)
    vi.spyOn(apiClient, 'previewLeaveRequest').mockResolvedValue(mockPreviewFiveDays)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('[P1] calls createLeaveRequest and invokes onSuccess on happy path', async () => {
    const onClose = vi.fn()
    const onSuccess = vi.fn()
    vi.spyOn(apiClient, 'createLeaveRequest').mockResolvedValue(mockCreateResponse)
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthTestProvider value={createMockAuthForRole('EMPLOYEE')}>
          <RequestLeaveModal open onClose={onClose} onSuccess={onSuccess} />
        </AuthTestProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Annual Leave/i })).toBeInTheDocument()
    })
    await user.selectOptions(screen.getByLabelText(/Leave Type/i), '1')
    await setLeaveDates('2026-06-01', '2026-06-07')
    await waitFor(() => expect(screen.getByTestId('submit-request-btn')).toBeEnabled())
    await user.click(screen.getByTestId('submit-request-btn'))

    await waitFor(() => {
      expect(apiClient.createLeaveRequest).toHaveBeenCalledWith({
        leaveTypeId: 1,
        dateFrom: '2026-06-01',
        dateTo: '2026-06-07',
        note: undefined,
      })
      expect(onSuccess).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('[P1] surfaces insufficient-balance problem.detail on submit failure', async () => {
    vi.spyOn(apiClient, 'createLeaveRequest').mockRejectedValue(
      new apiClient.ApiError(400, {
        type: 'https://ibiza.app/errors/insufficient-balance',
        title: 'Insufficient Balance',
        status: 400,
        detail: 'Only 2 working days remaining for Annual Leave',
      }),
    )
    const user = userEvent.setup()

    renderModal()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Annual Leave/i })).toBeInTheDocument()
    })
    await user.selectOptions(screen.getByLabelText(/Leave Type/i), '1')
    await setLeaveDates('2026-06-01', '2026-06-07')
    await waitFor(() => expect(screen.getByTestId('submit-request-btn')).toBeEnabled())
    await user.click(screen.getByTestId('submit-request-btn'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Only 2 working days remaining for Annual Leave',
      )
    })
  })
})
