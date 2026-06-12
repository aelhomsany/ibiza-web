import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { SettingsPage } from './SettingsPage'

function renderSettingsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole('HR_ADMIN')}>
        <SettingsPage />
      </AuthTestProvider>
    </QueryClientProvider>,
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      { id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] },
      { id: 2, name: 'Egypt', weekendDays: ['FRIDAY', 'SATURDAY'] },
    ])
    vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([
      {
        id: 1,
        workforceGroupId: 1,
        dateFrom: '2026-06-19',
        dateTo: '2026-06-19',
        name: 'Juneteenth',
      },
    ])
    vi.spyOn(apiClient, 'putWorkforceGroupWeekendDays').mockResolvedValue({
      id: 1,
      name: 'US',
      weekendDays: ['SATURDAY', 'SUNDAY', 'FRIDAY'],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders workforce group tabs and weekend chips', async () => {
    renderSettingsPage()

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'US' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Egypt' })).toBeInTheDocument()
    })

    expect(screen.getByTestId('weekend-chips')).toBeInTheDocument()
    expect(screen.getByText('Weekend days —')).toBeInTheDocument()
    expect(screen.getByText('US', { selector: '.settings-card-label span' })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('public-holidays-section')).toBeInTheDocument()
      expect(screen.getByText(/Juneteenth/)).toBeInTheDocument()
    })
  })

  it('calls PUT with updated weekend days when toggling a chip', async () => {
    const user = userEvent.setup()
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /Fri weekend day for US/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('checkbox', { name: /Fri weekend day for US/i }))

    await waitFor(() => {
      expect(apiClient.putWorkforceGroupWeekendDays).toHaveBeenCalledWith(1, [
        'SATURDAY',
        'SUNDAY',
        'FRIDAY',
      ])
    })
  })
})
