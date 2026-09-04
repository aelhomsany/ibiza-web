import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../api/client'
import type { SlackStatusResponse, UserRole } from '../../api/generated/types'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { ToastProvider } from '../../components/ui/ToastProvider'
import { MySettingsPage } from './MySettingsPage'

const slackNotConnected: SlackStatusResponse = {
  workspaceConnected: false,
  status: null,
  teamName: null,
  installedAt: null,
  lastErrorCategory: null,
  me: { linked: false, status: 'UNCHECKED' },
}

const slackConnected: SlackStatusResponse = {
  workspaceConnected: true,
  status: 'CONNECTED',
  teamName: 'Acme Workspace',
  installedAt: '2026-09-03T08:00:00Z',
  lastErrorCategory: null,
  me: { linked: true, status: 'LINKED' },
}

// Every personal card reads its own status; keep all of them quiet by default.
function mockPersonalApis() {
  vi.spyOn(apiClient, 'getNotificationPreferences').mockResolvedValue([
    { channel: 'IN_APP', scope: 'WORKFLOW', mandatory: true, enabled: true, mutedUntil: null, effectiveEnabledNow: true },
    { channel: 'EMAIL', scope: 'WORKFLOW', mandatory: false, enabled: true, mutedUntil: null, effectiveEnabledNow: true },
  ])
  vi.spyOn(apiClient, 'getSlackStatus').mockResolvedValue(slackNotConnected)
  vi.spyOn(apiClient, 'getCalendarFeed').mockResolvedValue({ active: false })
  vi.spyOn(apiClient, 'getCalendarSyncStatus').mockResolvedValue([
    {
      provider: 'GOOGLE',
      connected: false,
      accountEmail: null,
      status: 'DISCONNECTED',
      lastErrorCategory: null,
      lastSyncedAt: null,
      nextRetryAt: null,
      pendingEventCount: 0,
      failedEventCount: 0,
    },
  ])
}

function renderPage(role: UserRole = 'EMPLOYEE', initialPath = '/my-settings') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthTestProvider value={createMockAuthForRole(role)}>
            <MySettingsPage />
          </AuthTestProvider>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('MySettingsPage (Plan PUENTE D-12)', () => {
  beforeEach(() => {
    mockPersonalApis()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('[P0] an employee reaches their notification preferences and calendar cards', async () => {
    renderPage('EMPLOYEE')

    expect(screen.getByTestId('my-settings-page')).toHaveClass('page', 'page-wide')
    expect(screen.getByRole('heading', { name: 'My settings' })).toBeInTheDocument()

    const notifications = screen.getByTestId('my-settings-notifications-section')
    expect(within(notifications).getByRole('heading', { name: 'Notifications' })).toBeInTheDocument()
    expect(await within(notifications).findByTestId('notification-preferences-settings')).toBeInTheDocument()

    const integrations = screen.getByTestId('my-settings-integrations-section')
    expect(within(integrations).getByRole('heading', { name: 'My integrations' })).toBeInTheDocument()
    expect(await within(integrations).findByTestId('calendar-sync-settings')).toBeInTheDocument()
    expect(await within(integrations).findByTestId('calendar-feed-settings')).toBeInTheDocument()
    // Nothing Slack-related until an HR Admin has installed the workspace.
    await waitFor(() => expect(apiClient.getSlackStatus).toHaveBeenCalled())
    expect(screen.queryByTestId('slack-link-settings')).not.toBeInTheDocument()
    expect(screen.queryByText('How you are matched')).not.toBeInTheDocument()
  })

  it('[P1] shows "Your Slack" with a re-check once the workspace is connected, never showing Slack ids', async () => {
    const user = userEvent.setup()
    const notFound: SlackStatusResponse = { ...slackConnected, me: { linked: false, status: 'NOT_FOUND' } }
    const status = vi.spyOn(apiClient, 'getSlackStatus').mockResolvedValue(notFound)
    const link = vi.spyOn(apiClient, 'linkMeToSlack').mockResolvedValue({ linked: true, status: 'LINKED' })

    renderPage('MANAGER')

    const card = await screen.findByTestId('slack-link-settings')
    expect(within(card).getByTestId('slack-link-copy')).toHaveTextContent('connected to Acme Workspace')
    expect(within(card).getByTestId('slack-me-status')).toHaveTextContent(
      'Not linked — your Slack email differs from your Ibiza email',
    )
    expect(screen.getByText('How you are matched')).toBeInTheDocument()

    status.mockResolvedValue(slackConnected)
    await user.click(within(card).getByRole('button', { name: 'Check again' }))

    await waitFor(() => {
      expect(link).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('slack-me-status')).toHaveTextContent('Linked.')
    })
    expect(screen.getByText('Your Slack account is linked')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/U0[A-Z0-9]{6,}|T0[A-Z0-9]{6,}|xoxb-/)
  })

  it('[P1] announces a completed calendar connection once after the OAuth callback redirect', async () => {
    renderPage('EMPLOYEE', '/my-settings?calendarSync=connected')

    expect(
      await screen.findByText('Calendar connected. Approved leave will now appear on your calendar.'),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText('Calendar connected. Approved leave will now appear on your calendar.'),
    ).toHaveLength(1)
  })

  it('[P1] warns when the user declined calendar consent on the OAuth callback', async () => {
    renderPage('EMPLOYEE', '/my-settings?calendarSync=error&reason=access_denied')

    expect(
      await screen.findByText('Calendar connection was cancelled before access was granted.'),
    ).toBeInTheDocument()
  })
})
