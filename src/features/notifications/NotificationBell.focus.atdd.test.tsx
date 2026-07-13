import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import * as apiClient from '../../api/client'
import {
  AuthTestProvider,
  createMockAuthForRole,
} from '../../test/authTestUtils'
import { NotificationBell } from './NotificationBell'

function renderBell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <AuthTestProvider value={createMockAuthForRole('EMPLOYEE')}>
          <Routes>
            <Route path="*" element={<NotificationBell />} />
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const sampleNotifications = [
  {
    id: 1,
    type: 'NEW_REQUEST' as const,
    message: 'Riley Report requested Annual Leave for 5 working days',
    occurredAt: '2026-06-24T10:00:00Z',
    read: false,
    leaveRequestId: 10,
    linkPath: '/approvals',
  },
  {
    id: 2,
    type: 'APPROVED' as const,
    message: 'Alex approved your Annual Leave request',
    occurredAt: '2026-06-23T10:00:00Z',
    read: true,
    leaveRequestId: 9,
    linkPath: '/my-leaves',
  },
]

describe('NotificationBell ATDD — Story 10.7 focus management', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getUnreadNotificationCount').mockResolvedValue({ count: 1 })
    vi.spyOn(apiClient, 'getNotifications').mockResolvedValue(sampleNotifications)
    vi.spyOn(apiClient, 'markNotificationRead').mockResolvedValue({
      id: 1,
      type: 'NEW_REQUEST',
      message: 'Read',
      occurredAt: '2026-06-24T10:00:00Z',
      read: true,
      leaveRequestId: 10,
      linkPath: '/approvals',
    })
    vi.spyOn(apiClient, 'markAllNotificationsRead').mockResolvedValue({ updated: 2 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('[P0] moves focus to the first notification item when the panel opens with items', async () => {
    const user = userEvent.setup()
    renderBell()

    const bell = await screen.findByTestId('notification-bell')
    await user.click(bell)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /riley report requested annual leave/i }),
      ).toHaveFocus()
    })
  })

  test('[P0] moves focus to the panel container when open while loading or empty', async () => {
    vi.spyOn(apiClient, 'getNotifications').mockImplementation(
      () => new Promise(() => undefined),
    )

    const user = userEvent.setup()
    renderBell()

    await user.click(await screen.findByTestId('notification-bell'))
    const panel = await screen.findByTestId('notification-panel')

    await waitFor(() => {
      expect(panel).toHaveFocus()
    })
    expect(panel).toHaveAttribute('tabindex', '-1')
  })

  test('[P0] returns focus to the bell when the panel closes via Escape', async () => {
    const user = userEvent.setup()
    renderBell()

    const bell = await screen.findByTestId('notification-bell')
    await user.click(bell)
    await screen.findByTestId('notification-panel')

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument()
      expect(bell).toHaveFocus()
    })
  })

  test('[P0] returns focus to the bell when the panel closes via outside click', async () => {
    const user = userEvent.setup()
    renderBell()

    const bell = await screen.findByTestId('notification-bell')
    await user.click(bell)
    await screen.findByTestId('notification-panel')

    await user.click(document.body)

    await waitFor(() => {
      expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument()
      expect(bell).toHaveFocus()
    })
  })

  test('[P0] returns focus to the bell when the panel closes after item navigation', async () => {
    const user = userEvent.setup()
    renderBell()

    const bell = await screen.findByTestId('notification-bell')
    await user.click(bell)
    await user.click(
      await screen.findByRole('button', { name: /riley report requested annual leave/i }),
    )

    await waitFor(() => {
      expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument()
      expect(bell).toHaveFocus()
    })
  })

  test('[P1] keeps focus inside the panel after mark-all-read completes', async () => {
    const user = userEvent.setup()
    renderBell()

    await user.click(await screen.findByTestId('notification-bell'))
    await screen.findByTestId('notification-panel')
    await user.click(screen.getByRole('button', { name: /mark all read/i }))

    await waitFor(() => {
      const panel = screen.getByTestId('notification-panel')
      const focused = document.activeElement
      expect(panel.contains(focused)).toBe(true)
      expect(focused).not.toBe(document.body)
    })
  })

  test('[P1] retains focus on Mark All Read when its request fails', async () => {
    const markAllReadSpy = vi
      .spyOn(apiClient, 'markAllNotificationsRead')
      .mockRejectedValueOnce(new Error('Network failure'))
    const user = userEvent.setup()
    renderBell()

    await user.click(await screen.findByTestId('notification-bell'))
    const markAllButton = await screen.findByRole('button', { name: /mark all read/i })
    await user.click(markAllButton)

    await waitFor(() => {
      expect(markAllReadSpy).toHaveBeenCalledOnce()
      expect(markAllButton).toHaveFocus()
    })
  })

  test('[P1] announces notification panel loading via role=status', async () => {
    vi.spyOn(apiClient, 'getNotifications').mockImplementation(
      () => new Promise(() => undefined),
    )

    const user = userEvent.setup()
    renderBell()

    await user.click(await screen.findByTestId('notification-bell'))

    expect(
      await screen.findByRole('status', { name: /loading/i }),
    ).toHaveAttribute('aria-busy', 'true')
  })
})
