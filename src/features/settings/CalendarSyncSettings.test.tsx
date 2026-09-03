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
  pendingEventCount: 0,
  failedEventCount: 0,
}

const connected: CalendarSyncStatusResponse = {
  provider: 'GOOGLE',
  connected: true,
  accountEmail: 'calendar-user@example.com',
  status: 'CONNECTED',
  lastErrorCategory: null,
  lastSyncedAt: '2026-07-05T12:00:00Z',
  nextRetryAt: null,
  pendingEventCount: 0,
  failedEventCount: 0,
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
    vi.spyOn(apiClient, 'getCalendarSyncStatus').mockResolvedValue([disconnected])
    vi.spyOn(apiClient, 'connectCalendarSync').mockResolvedValue({
      provider: 'GOOGLE',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=opaque',
    })

    renderCard()

    expect(await screen.findByTestId('calendar-sync-status-google')).toHaveTextContent('Not connected')
    expect(screen.queryByTestId('calendar-sync-retry-google')).not.toBeInTheDocument()
    expect(screen.queryByTestId('calendar-sync-disconnect-google')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('calendar-sync-connect-google'))

    await waitFor(() => {
      expect(apiClient.connectCalendarSync).toHaveBeenCalledWith('GOOGLE')
      expect(assign).toHaveBeenCalledWith(expect.stringContaining('accounts.google.com'))
    })
  })

  it('renders one row per provider the API lists', async () => {
    vi.spyOn(apiClient, 'getCalendarSyncStatus').mockResolvedValue([
      connected,
      { ...disconnected, provider: 'MICROSOFT' },
    ])

    renderCard()

    expect(await screen.findByTestId('calendar-sync-row-google')).toHaveTextContent('Google Calendar')
    expect(screen.getByTestId('calendar-sync-status-google')).toHaveTextContent('Connected · calendar-user@example.com')
    expect(screen.getByTestId('calendar-sync-row-microsoft')).toHaveTextContent('Outlook / Microsoft 365')
    expect(screen.getByTestId('calendar-sync-status-microsoft')).toHaveTextContent('Not connected')
    expect(screen.getByTestId('calendar-sync-connect-microsoft')).toBeInTheDocument()
    expect(screen.queryByTestId('calendar-sync-connect-google')).not.toBeInTheDocument()
  })

  it('shows connected account and confirms disconnect with the shared modal', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    vi.spyOn(apiClient, 'getCalendarSyncStatus').mockResolvedValue([connected])
    vi.spyOn(apiClient, 'disconnectCalendarSync').mockResolvedValue(undefined)

    renderCard(onSuccess)

    expect(await screen.findByText(/calendar-user@example.com/)).toBeInTheDocument()
    expect(screen.queryByTestId('calendar-sync-retry-google')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('calendar-sync-disconnect-google'))

    expect(screen.getByTestId('calendar-sync-disconnect-modal')).toHaveTextContent('Google Calendar')
    await user.click(screen.getByRole('button', { name: 'Confirm Disconnect' }))

    await waitFor(() => {
      expect(apiClient.disconnectCalendarSync).toHaveBeenCalledWith('GOOGLE')
      expect(onSuccess).toHaveBeenCalledWith('Calendar sync disconnected')
    })
  })

  // The API never reports connected=true together with ERROR: a demoted account is not
  // connected. The retry button keys off the status and the failed count, not the flag.
  it('shows retry for a connection error without leaking the stored secret', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    vi.spyOn(apiClient, 'getCalendarSyncStatus').mockResolvedValue([
      {
        ...connected,
        connected: false,
        status: 'ERROR',
        lastErrorCategory: 'PROVIDER_CONFIG',
      },
    ])
    vi.spyOn(apiClient, 'retryCalendarSync').mockResolvedValue(undefined)

    renderCard(onSuccess)

    expect(await screen.findByText(/Error category: PROVIDER_CONFIG/)).toBeInTheDocument()
    expect(screen.queryByText(/refresh-token|access-token|client-secret/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('calendar-sync-connect-google')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('calendar-sync-retry-google'))

    await waitFor(() => {
      expect(apiClient.retryCalendarSync).toHaveBeenCalledWith('GOOGLE')
      expect(onSuccess).toHaveBeenCalledWith('Calendar sync retry queued')
    })
  })

  it('counts events waiting and failed, and offers retry only when something failed', async () => {
    vi.spyOn(apiClient, 'getCalendarSyncStatus')
      .mockResolvedValueOnce([{ ...connected, pendingEventCount: 2 }])
      .mockResolvedValueOnce([{ ...connected, pendingEventCount: 1, failedEventCount: 1 }])

    const { unmount } = renderCard()
    expect(await screen.findByTestId('calendar-sync-pending-google')).toHaveTextContent('2 events waiting to retry')
    expect(screen.queryByTestId('calendar-sync-failed-google')).not.toBeInTheDocument()
    expect(screen.queryByTestId('calendar-sync-retry-google')).not.toBeInTheDocument()
    unmount()

    renderCard()
    expect(await screen.findByTestId('calendar-sync-failed-google')).toHaveTextContent('1 event failed to sync')
    expect(screen.getByTestId('calendar-sync-pending-google')).toHaveTextContent('1 event waiting to retry')
    expect(screen.getByTestId('calendar-sync-status-google')).toHaveTextContent('Connected')
    expect(screen.getByTestId('calendar-sync-retry-google')).toBeInTheDocument()
  })

  it('asks a revoked account to reconnect rather than retry', async () => {
    vi.spyOn(apiClient, 'getCalendarSyncStatus').mockResolvedValue([
      { ...connected, connected: false, status: 'REVOKED', lastErrorCategory: 'REVOKED_CONSENT' },
    ])

    renderCard()

    expect(await screen.findByTestId('calendar-sync-status-google')).toHaveTextContent('Connection needs attention')
    expect(screen.getByTestId('calendar-sync-connect-google')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-sync-disconnect-google')).toBeInTheDocument()
    expect(screen.queryByTestId('calendar-sync-retry-google')).not.toBeInTheDocument()
  })

  // Connect is an outward-facing OAuth grant, so what the connection then writes has to be
  // readable BEFORE the button, not discovered after it. Each line is what CalendarSyncWorker
  // actually does — and it deliberately does not say the sync respects Calendar visibility,
  // because it does not: the worker titles every event `<leave type> - <person>` with no
  // reference to the privacy matrix. Do not restore that claim without the code to back it.
  it('says what the connection writes, and claims no privacy filtering it does not do', async () => {
    vi.spyOn(apiClient, 'getCalendarSyncStatus').mockResolvedValue([disconnected])

    renderCard()

    const rail = await screen.findByRole('complementary')
    expect(rail).toHaveTextContent(/Only approved leave, and only for people who are still active/)
    expect(rail).toHaveTextContent(/Each event is titled with the leave type and the person's name/)
    expect(rail).toHaveTextContent(/Events are written to the connected account's own calendar/)
    expect(rail).toHaveTextContent(/Declined requests are removed from the calendar again/)
    expect(rail).not.toHaveTextContent(/visibility|privacy/i)
  })
})
