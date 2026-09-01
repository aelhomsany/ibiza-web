import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../api/client'
import type { CalendarSyncStatusResponse } from '../../api/generated/types'
import { CalendarSyncSettings } from './CalendarSyncSettings'

const disconnected: CalendarSyncStatusResponse = {
  provider: 'GOOGLE',
  connected: false,
  accountEmail: null,
  status: 'DISCONNECTED',
  lastErrorCategory: null,
  lastSyncedAt: null,
  nextRetryAt: null,
}

const connected: CalendarSyncStatusResponse = {
  provider: 'GOOGLE',
  connected: true,
  accountEmail: 'calendar-user@example.com',
  status: 'CONNECTED',
  lastErrorCategory: null,
  lastSyncedAt: '2026-07-05T12:00:00Z',
  nextRetryAt: null,
}

function renderCard(onSuccess = vi.fn(), onWarning = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CalendarSyncSettings onSuccess={onSuccess} onWarning={onWarning} />
    </QueryClientProvider>,
  )
}

describe('CalendarSyncSettings', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows disconnected state and starts OAuth connect through the API client', async () => {
    const user = userEvent.setup()
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    vi.spyOn(apiClient, 'getCalendarSyncStatus').mockResolvedValue(disconnected)
    vi.spyOn(apiClient, 'connectCalendarSync').mockResolvedValue({
      provider: 'GOOGLE',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=opaque',
    })

    renderCard()

    expect(await screen.findByTestId('calendar-sync-status')).toHaveTextContent('Not connected')
    await user.click(screen.getByTestId('calendar-sync-connect'))

    await waitFor(() => {
      expect(apiClient.connectCalendarSync).toHaveBeenCalledWith('GOOGLE')
      expect(assign).toHaveBeenCalledWith(expect.stringContaining('accounts.google.com'))
    })
  })

  it('shows connected account and confirms disconnect with the shared modal', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    vi.spyOn(apiClient, 'getCalendarSyncStatus').mockResolvedValue(connected)
    vi.spyOn(apiClient, 'disconnectCalendarSync').mockResolvedValue(undefined)

    renderCard(onSuccess)

    expect(await screen.findByText(/calendar-user@example.com/)).toBeInTheDocument()
    await user.click(screen.getByTestId('calendar-sync-disconnect'))

    expect(screen.getByTestId('calendar-sync-disconnect-modal')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm Disconnect' }))

    await waitFor(() => {
      expect(apiClient.disconnectCalendarSync).toHaveBeenCalledWith('GOOGLE')
      expect(onSuccess).toHaveBeenCalledWith('Calendar sync disconnected')
    })
  })

  it('shows retry action for non-secret error state', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    vi.spyOn(apiClient, 'getCalendarSyncStatus').mockResolvedValue({
      ...connected,
      status: 'ERROR',
      lastErrorCategory: 'THROTTLED',
    })
    vi.spyOn(apiClient, 'retryCalendarSync').mockResolvedValue(undefined)

    renderCard(onSuccess)

    expect(await screen.findByText(/Error category: THROTTLED/)).toBeInTheDocument()
    expect(screen.queryByText(/refresh-token|access-token|client-secret/i)).not.toBeInTheDocument()

    await user.click(screen.getByTestId('calendar-sync-retry'))

    await waitFor(() => {
      expect(apiClient.retryCalendarSync).toHaveBeenCalledWith('GOOGLE')
      expect(onSuccess).toHaveBeenCalledWith('Calendar sync retry queued')
    })
  })

  // Connect is an outward-facing OAuth grant, so what the connection then writes has to be
  // readable BEFORE the button, not discovered after it. Each line is what CalendarSyncWorker
  // actually does — and it deliberately does not say the sync respects Calendar visibility,
  // because it does not: the worker titles every event `<leave type> - <person>` with no
  // reference to the privacy matrix. Do not restore that claim without the code to back it.
  it('says what the connection writes, and claims no privacy filtering it does not do', async () => {
    vi.spyOn(apiClient, 'getCalendarSyncStatus').mockResolvedValue(disconnected)

    renderCard()

    const rail = await screen.findByRole('complementary')
    expect(rail).toHaveTextContent(/Only approved leave, and only for people who are still active/)
    expect(rail).toHaveTextContent(/Each event is titled with the leave type and the person's name/)
    expect(rail).toHaveTextContent(/Events are written to the connected account's own calendar/)
    expect(rail).not.toHaveTextContent(/visibility|privacy/i)
  })
})
