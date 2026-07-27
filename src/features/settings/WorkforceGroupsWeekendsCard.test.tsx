import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { WorkforceGroupsWeekendsCard } from './WorkforceGroupsWeekendsCard'

function renderCard(options?: { onSuccess?: (message: string) => void; onWarning?: (message: string) => void }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const onSuccess = options?.onSuccess ?? vi.fn()
  const onWarning = options?.onWarning ?? vi.fn()

  render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole('HR_ADMIN')}>
        <WorkforceGroupsWeekendsCard onSuccess={onSuccess} onWarning={onWarning} />
      </AuthTestProvider>
    </QueryClientProvider>,
  )

  return { onSuccess, onWarning }
}

describe('WorkforceGroupsWeekendsCard', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getTeamMembers').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading state while workforce groups are fetching', () => {
    vi.spyOn(apiClient, 'getWorkforceGroups').mockImplementation(() => new Promise(() => {}))

    renderCard()

    expect(screen.getByText('Loading workforce groups…')).toBeInTheDocument()
  })

  it('shows error state when workforce groups fail to load', async () => {
    vi.spyOn(apiClient, 'getWorkforceGroups').mockRejectedValue(new Error('Network error'))

    renderCard()

    await waitFor(() => {
      expect(screen.getByText('Unable to load workforce groups.')).toBeInTheDocument()
    })
  })

  it('shows empty state when no workforce groups exist', async () => {
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([])

    renderCard()

    await waitFor(() => {
      expect(screen.getByText('No workforce groups configured yet.')).toBeInTheDocument()
    })
  })

  it('switches active group when a tab is clicked', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      { id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] },
      { id: 2, name: 'Egypt', weekendDays: ['FRIDAY', 'SATURDAY'] },
    ])
    vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([])

    renderCard()

    await waitFor(() => {
      expect(screen.getByText('US', { selector: '.settings-card-label span' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: 'Egypt' }))

    await waitFor(() => {
      expect(screen.getByText('Egypt', { selector: '.settings-card-label span' })).toBeInTheDocument()
    })
  })

  it('keeps the impact visible and disables Save for a zero-day draft', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      { id: 1, name: 'US', weekendDays: ['SATURDAY'] },
    ])
    vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([])

    renderCard()

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /Sat weekend day for US/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('checkbox', { name: /Sat weekend day for US/i }))

    expect(screen.getByTestId('working-calendars-impact')).toBeInTheDocument()
    expect(screen.getByText('Select at least one weekend day')).toBeInTheDocument()
    expect(screen.getByTestId('working-calendars-save-btn')).toBeDisabled()
  })
})
