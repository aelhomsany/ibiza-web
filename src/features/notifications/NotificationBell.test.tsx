import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import {
  AuthTestProvider,
  createMockAuthForRole,
} from '../../test/authTestUtils'
import { NotificationBell } from './NotificationBell'

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location">{location.pathname}</span>
}

function renderBell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <AuthTestProvider value={createMockAuthForRole('EMPLOYEE')}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  <NotificationBell />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getUnreadNotificationCount').mockResolvedValue({ count: 0 })
    vi.spyOn(apiClient, 'getNotifications').mockResolvedValue([])
    vi.spyOn(apiClient, 'markNotificationRead').mockResolvedValue({
      id: 1,
      type: 'NEW_REQUEST',
      message: 'Read',
      occurredAt: '2026-06-24T10:00:00Z',
      read: true,
      leaveRequestId: 10,
      linkPath: '/approvals',
    })
    vi.spyOn(apiClient, 'markAllNotificationsRead').mockResolvedValue({ updated: 1 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('[P0] shows unread badge only when unread count is greater than zero', async () => {
    vi.spyOn(apiClient, 'getUnreadNotificationCount').mockResolvedValue({ count: 3 })

    renderBell()

    const bell = await screen.findByRole('button', { name: /notifications, 3 unread/i })
    expect(bell).toBeInTheDocument()
    expect(screen.getByTestId('notification-badge')).toHaveTextContent('3')
  })

  it('[P0] hides unread badge at zero', async () => {
    renderBell()

    expect(await screen.findByRole('button', { name: /^notifications$/i })).toBeInTheDocument()
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument()
  })

  it('[P1] opens panel with unread styling and empty state support', async () => {
    vi.spyOn(apiClient, 'getNotifications').mockResolvedValue([
      {
        id: 1,
        type: 'NEW_REQUEST',
        message: 'Riley Report requested Annual Leave for 5 working days',
        occurredAt: '2026-06-24T10:00:00Z',
        read: false,
        leaveRequestId: 10,
        linkPath: '/approvals',
      },
      {
        id: 2,
        type: 'APPROVED',
        message: 'Alex approved your Annual Leave request',
        occurredAt: '2026-06-23T10:00:00Z',
        read: true,
        leaveRequestId: 9,
        linkPath: '/my-leaves',
      },
    ])

    const user = userEvent.setup()
    renderBell()

    await user.click(await screen.findByTestId('notification-bell'))

    expect(await screen.findByTestId('notification-panel')).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
    const unreadItem = screen.getByRole('button', {
      name: /riley report requested annual leave/i,
    })
    expect(unreadItem).toHaveClass('notification-item--unread')
    expect(screen.getByRole('button', { name: /alex approved/i })).not.toHaveClass(
      'notification-item--unread',
    )
  })

  it('[P1] marks unread item read, closes panel, and navigates to link path', async () => {
    vi.spyOn(apiClient, 'getNotifications').mockResolvedValue([
      {
        id: 7,
        type: 'NEW_REQUEST',
        message: 'Riley Report requested Annual Leave for 5 working days',
        occurredAt: '2026-06-24T10:00:00Z',
        read: false,
        leaveRequestId: 10,
        linkPath: '/approvals',
      },
    ])

    const user = userEvent.setup()
    renderBell()

    await user.click(await screen.findByTestId('notification-bell'))
    await user.click(await screen.findByRole('button', { name: /riley report requested/i }))

    await waitFor(() => {
      expect(apiClient.markNotificationRead).toHaveBeenCalled()
      expect(vi.mocked(apiClient.markNotificationRead).mock.calls[0]?.[0]).toBe(7)
      expect(screen.getByTestId('location')).toHaveTextContent('/approvals')
      expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument()
    })
  })

  it('[P2] shows empty state copy', async () => {
    const user = userEvent.setup()
    renderBell()

    await user.click(await screen.findByTestId('notification-bell'))

    expect(await screen.findByText('No notifications yet')).toBeInTheDocument()
  })
})
