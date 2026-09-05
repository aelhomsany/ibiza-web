import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import type {
  CalendarMonthResponse,
  LeaveRequestContextResponse,
} from '../../api/generated/types'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { CalendarAgenda } from './CalendarAgenda'
import { CalendarTimeline } from './CalendarTimeline'
import { TeamCalendarPage } from './TeamCalendarPage'
import { mockCalendarMonth } from './calendarTestFixtures'
import { RequestContextPage } from '../leave-requests/RequestContextPage'

const clickThroughCalendar = {
  ...mockCalendarMonth,
  absences: [
    {
      ...mockCalendarMonth.absences[0],
      requestId: 86,
      userFullName: 'Sarah Chen',
      leaveTypeName: 'Annual Leave',
      dateFrom: '2026-06-10',
      dateTo: '2026-06-12',
      workingDays: 3,
      canViewRequestContext: true,
    },
    {
      ...mockCalendarMonth.absences[1],
      requestId: 87,
      userFullName: 'Omar Hassan',
      leaveTypeName: 'Work From Home',
      dateFrom: '2026-06-15',
      dateTo: '2026-06-15',
      workingDays: 1,
      canViewRequestContext: false,
    },
  ],
} as CalendarMonthResponse

const requestContext = {
  id: 86,
  leaveTypeId: 1,
  leaveTypeName: 'Annual Leave',
  leaveTypeIcon: 'leave',
  leaveTypeColor: '#093C5D',
  leaveTypeBackgroundColor: '#D6E8ED',
  leaveTypeBorderColor: '#0E4F75',
  dateFrom: '2026-06-10',
  dateTo: '2026-06-12',
  workingDays: 3,
  status: 'APPROVED',
  statusHint: 'Approved by Mina',
  declineReason: null,
  approverFirstName: 'Mina',
  requesterFullName: 'Sarah Chen',
} as LeaveRequestContextResponse

type CalendarClickThroughApiClient = typeof apiClient & {
  getLeaveRequestContext: (requestId: number) => Promise<LeaveRequestContextResponse>
}

function renderWithProviders(ui: ReactElement, initialEntries = ['/calendar']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole('EMPLOYEE')}>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </AuthTestProvider>
    </QueryClientProvider>,
  )
}

describe('Team Calendar click-through ATDD - Story 8.6', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-06-15T12:00:00Z') })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('[P0] renders a permitted timeline bar as an accessible request link', () => {
    render(
      <MemoryRouter>
        <CalendarTimeline
          calendar={clickThroughCalendar}
          weekStart="2026-06-07"
          weekendDays={clickThroughCalendar.viewerWeekendDays}
          locale="en-US"
        />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', {
      name: /Open request context for Sarah Chen, Annual Leave, Off, Jun 10, 2026 – Jun 12, 2026/i,
    })

    expect(link).toHaveAttribute('href', '/leave-requests/86')
    expect(link).toHaveAttribute('data-testid', 'calendar-event-86')
    expect(link).toHaveClass('calendar-timeline-bar', 'cal-event--off')
  })

  it('[P0] keeps a non-permitted agenda card read-only and out of the tab order', () => {
    render(
      <MemoryRouter>
        <CalendarAgenda
          calendar={clickThroughCalendar}
          month="2026-06"
          weekendDays={clickThroughCalendar.viewerWeekendDays}
          selectedDate={null}
          onSelectedDateChange={() => undefined}
          locale="en-US"
        />
      </MemoryRouter>,
    )

    expect(
      screen.queryByRole('link', {
        name: /Omar Hassan Work From Home/i,
      }),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('calendar-event-87')).toHaveTextContent('OH')
    expect(screen.getByTestId('calendar-event-87')).not.toHaveAttribute('tabindex')
    expect(screen.getByTestId('calendar-event-87')).toHaveClass(
      'calendar-agenda-card',
      'cal-event--wfh',
    )
  })

  it('[P0] exposes an informational accessible name on a read-only agenda card (Story 10.7)', () => {
    render(
      <MemoryRouter>
        <CalendarAgenda
          calendar={clickThroughCalendar}
          month="2026-06"
          weekendDays={clickThroughCalendar.viewerWeekendDays}
          selectedDate={null}
          onSelectedDateChange={() => undefined}
          locale="en-US"
        />
      </MemoryRouter>,
    )

    const chip = screen.getByTestId('calendar-event-87')
    expect(chip).toHaveAccessibleName(/Omar Hassan, Work From Home, WFH, Jun 15, 2026/i)
    expect(chip.tagName).toBe('SPAN')
    expect(chip).not.toHaveAttribute('tabindex')
  })

  it('[P0] navigates from the Team Calendar page to the selected request context', async () => {
    vi.spyOn(apiClient, 'getCalendarMonth').mockResolvedValue(clickThroughCalendar)
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([])
    const user = userEvent.setup()

    renderWithProviders(
      <Routes>
        <Route path="/calendar" element={<TeamCalendarPage />} />
        <Route
          path="/leave-requests/:id"
          element={<h1 data-testid="request-context-heading">Annual Leave for Sarah Chen</h1>}
        />
      </Routes>,
    )

    await screen.findByTestId('calendar-timeline')
    await user.click(screen.getByTestId('calendar-prev-week'))

    const link = await screen.findByRole('link', {
      name: /Open request context for Sarah Chen, Annual Leave, Off/i,
    })
    link.focus()
    expect(link).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(await screen.findByTestId('request-context-heading')).toHaveTextContent(
      'Annual Leave for Sarah Chen',
    )
  })

  it('[P0] request context route renders summary fields', async () => {
    const contextSpy = vi.spyOn(
      apiClient as CalendarClickThroughApiClient,
      'getLeaveRequestContext',
    ).mockResolvedValue(requestContext)

    renderWithProviders(
      <Routes>
        <Route path="/leave-requests/:id" element={<RequestContextPage />} />
      </Routes>,
      ['/leave-requests/86'],
    )

    await waitFor(() => {
      expect(contextSpy).toHaveBeenCalledWith(86)
    })
    expect(await screen.findByRole('heading', { name: 'Annual Leave' })).toBeInTheDocument()
    expect(screen.getAllByText('Sarah Chen')).toHaveLength(2)
    expect(screen.getByText('Jun 10, 2026 – Jun 12, 2026')).toBeInTheDocument()
    expect(screen.getByText('3 working days')).toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('[P0] request context route renders denied problem states without private details', async () => {
    vi.spyOn(
      apiClient as CalendarClickThroughApiClient,
      'getLeaveRequestContext',
    ).mockRejectedValue(
      new apiClient.ApiError(404, {
        type: 'https://leaveo.net/errors/not-found',
        title: 'Not found',
        detail: 'Leave request was not found.',
        status: 404,
      }),
    )

    renderWithProviders(
      <Routes>
        <Route path="/leave-requests/:id" element={<RequestContextPage />} />
      </Routes>,
      ['/leave-requests/999'],
    )

    expect(await screen.findByRole('heading', { name: 'Request Not Found' })).toBeInTheDocument()
    expect(screen.getByTestId('request-context-error')).toHaveTextContent(
      'Leave request was not found.',
    )
    expect(screen.queryByText('Sarah Chen')).not.toBeInTheDocument()
    expect(screen.queryByText('Annual Leave')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back To Calendar' })).toHaveAttribute(
      'href',
      '/calendar',
    )
  })
})
