import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import type { WorkforceGroupResponse } from '../../api/generated/types'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { TeamCalendarPage } from './TeamCalendarPage'
import { mockCalendarMonth } from './calendarTestFixtures'

const workforceGroups: WorkforceGroupResponse[] = [
  {
    id: 1,
    name: 'US',
    weekendDays: ['SATURDAY', 'SUNDAY'],
  },
  {
    id: 2,
    name: 'Egypt',
    weekendDays: ['FRIDAY', 'SATURDAY'],
  },
]

function renderTeamCalendarPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole('EMPLOYEE')}>
        <MemoryRouter>
          <TeamCalendarPage />
        </MemoryRouter>
      </AuthTestProvider>
    </QueryClientProvider>,
  )
}

describe('TeamCalendarPage', () => {
  beforeEach(() => {
    // Pin Date to the fixture month (June 2026). The page bootstraps its month
    // from the real clock and reconciles against the server `today`; if they
    // differ (e.g. real month rolled past the fixture) every test does a racy
    // double-fetch. Fake only Date so timers/userEvent stay real.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-06-15T12:00:00Z') })
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue(workforceGroups)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('[P0/P1] renders the real page full-bleed with calendar landmarks', async () => {
    vi.spyOn(apiClient, 'getCalendarMonth').mockResolvedValue(mockCalendarMonth)

    renderTeamCalendarPage()

    expect(screen.getByTestId('team-calendar-page')).toHaveClass('page', 'page-wide')
    expect(await screen.findByRole('heading', { name: 'Team Calendar' })).toBeInTheDocument()
    expect(await screen.findByText('June 2026')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-month-grid')).toBeInTheDocument()
  })

  it('[P0] refetches with yyyy-MM month when navigating months', async () => {
    const calendarSpy = vi
      .spyOn(apiClient, 'getCalendarMonth')
      .mockResolvedValueOnce(mockCalendarMonth)
      .mockResolvedValue({
        ...mockCalendarMonth,
        month: '2026-07',
        monthStart: '2026-07-01',
        monthEnd: '2026-07-31',
        today: '2026-06-15',
      })
    const user = userEvent.setup()

    renderTeamCalendarPage()

    await screen.findByText('June 2026')
    await user.click(screen.getByTestId('calendar-next-month'))

    await waitFor(() => {
      expect(calendarSpy).toHaveBeenCalledWith('2026-07')
    })
    expect(await screen.findByText('July 2026')).toBeInTheDocument()
  })

  it('[P0] renders org-wide absences with All Groups as the default filter', async () => {
    vi.spyOn(apiClient, 'getCalendarMonth').mockResolvedValue(mockCalendarMonth)

    renderTeamCalendarPage()

    expect(await screen.findByRole('combobox', { name: /Workforce Group/i })).toHaveDisplayValue(
      'All Groups',
    )
    expect(await screen.findByText('Sarah')).toBeInTheDocument()
    expect(screen.getByText('Omar')).toBeInTheDocument()
  })

  it('[P0] loads Workforce Group options and renders a reversible accessible filter', async () => {
    vi.spyOn(apiClient, 'getCalendarMonth').mockResolvedValue(mockCalendarMonth)
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue(workforceGroups)
    const user = userEvent.setup()

    renderTeamCalendarPage()

    const filter = await screen.findByRole('combobox', { name: /Workforce Group/i })
    expect(filter).toHaveDisplayValue('All Groups')
    expect(screen.getByRole('option', { name: 'All Groups' })).toHaveValue('')
    expect(await screen.findByRole('option', { name: 'US' })).toHaveValue('1')
    expect(screen.getByRole('option', { name: 'Egypt' })).toHaveValue('2')

    await user.selectOptions(filter, '2')
    expect(filter).toHaveDisplayValue('Egypt')

    await user.click(screen.getByRole('button', { name: /Clear Workforce Group filter/i }))
    expect(filter).toHaveDisplayValue('All Groups')
  })

  it('[P0] refetches calendar with workforceGroupId and clears back to org-wide', async () => {
    const calendarSpy = vi.spyOn(apiClient, 'getCalendarMonth').mockResolvedValue(mockCalendarMonth)
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue(workforceGroups)
    const user = userEvent.setup()

    renderTeamCalendarPage()

    await screen.findByRole('option', { name: 'Egypt' })
    await user.selectOptions(
      await screen.findByRole('combobox', { name: /Workforce Group/i }),
      '2',
    )
    await waitFor(() => {
      expect(calendarSpy).toHaveBeenCalledWith('2026-06', 2)
    })

    await user.click(screen.getByRole('button', { name: /Clear Workforce Group filter/i }))
    await waitFor(() => {
      expect(calendarSpy).toHaveBeenLastCalledWith('2026-06')
    })
  })

  it('[P0] keeps selected Workforce Group when navigating months', async () => {
    const calendarSpy = vi.spyOn(apiClient, 'getCalendarMonth').mockResolvedValue(mockCalendarMonth)
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue(workforceGroups)
    const user = userEvent.setup()

    renderTeamCalendarPage()

    await screen.findByRole('option', { name: 'US' })
    await user.selectOptions(
      await screen.findByRole('combobox', { name: /Workforce Group/i }),
      '1',
    )
    await user.click(screen.getByTestId('calendar-next-month'))

    await waitFor(() => {
      expect(calendarSpy).toHaveBeenCalledWith('2026-07', 1)
    })
  })

  it('[P1] surfaces API problem details without rendering an empty success grid', async () => {
    vi.spyOn(apiClient, 'getCalendarMonth').mockRejectedValue(
      new apiClient.ApiError(400, {
        title: 'Validation failed',
        detail: 'Viewer must belong to a Workforce Group to view the calendar.',
        status: 400,
      }),
    )

    renderTeamCalendarPage()

    expect(await screen.findByTestId('team-calendar-error')).toHaveTextContent(
      'Viewer must belong to a Workforce Group to view the calendar.',
    )
    expect(screen.queryByTestId('calendar-month-grid')).not.toBeInTheDocument()
  })
})
