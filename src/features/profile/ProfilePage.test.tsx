import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../api/client'
import type { SlackStatusResponse } from '../../api/generated/types'
import { AuthTestProvider, createMockAuthForRole, mockUsers } from '../../test/authTestUtils'
import { ToastProvider } from '../../components/ui/ToastProvider'
import { ProfilePage } from './ProfilePage'

const mockUserWithImage = {
  id: 2,
  email: 'sarah@company.com',
  fullName: 'Sarah Chen',
  role: 'EMPLOYEE' as const,
  organizationId: 1,
  organizationName: 'Nile Harbor',
  timezone: 'America/New_York',
  workforceGroupName: 'US',
  preferredLanguage: null,
  profileImageUrl: '/api/v1/users/me/profile-image/content?v=1',
}

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

// The personal cards (Plan PUENTE D-12) read their own status; keep every one of them quiet by default.
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

function renderProfilePage(authOverrides = createMockAuthForRole('EMPLOYEE'), initialPath = '/profile') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthTestProvider value={authOverrides}>
            <ProfilePage />
          </AuthTestProvider>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('ProfilePage', () => {
  beforeEach(() => {
    mockPersonalApis()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('[P0] renders full-bleed profile summary with current-user fields', async () => {
    renderProfilePage(createMockAuthForRole('EMPLOYEE'))

    expect(screen.getByTestId('profile-page')).toHaveClass('page', 'page-wide')
    expect(screen.getByRole('heading', { name: 'Profile details' })).toBeInTheDocument()
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument()
    expect(screen.getByText('sarah@company.com')).toBeInTheDocument()
    expect(screen.getByText('Employee')).toBeInTheDocument()
    expect(screen.getByText('US')).toBeInTheDocument()
    expect(screen.getByText('America/New_York')).toBeInTheDocument()
    expect(screen.getByText('Not set')).toBeInTheDocument()
  })

  it('[P0] upload success refreshes shared auth state so the header avatar can update', async () => {
    const refreshUser = vi.fn().mockResolvedValue(mockUserWithImage)
    vi.spyOn(apiClient, 'uploadProfileImage').mockResolvedValue(mockUserWithImage)

    renderProfilePage({
      ...createMockAuthForRole('EMPLOYEE'),
      refreshUser,
    })

    const file = new File([new Uint8Array([137, 80, 78, 71])], 'avatar.png', {
      type: 'image/png',
    })
    const input = screen.getByTestId('profile-image-input')
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(apiClient.uploadProfileImage).toHaveBeenCalledWith(file)
      expect(refreshUser).toHaveBeenCalledTimes(1)
    })
  })

  it('[P1] removing the profile image calls the API and refreshes shared auth state', async () => {
    const refreshUser = vi.fn().mockResolvedValue({
      ...mockUserWithImage,
      profileImageUrl: undefined,
    })
    vi.spyOn(apiClient, 'removeProfileImage').mockResolvedValue(undefined)

    renderProfilePage({
      ...createMockAuthForRole('EMPLOYEE'),
      user: mockUserWithImage,
      refreshUser,
    })

    await userEvent.click(screen.getByTestId('profile-image-remove-btn'))
    await userEvent.click(screen.getByTestId('profile-image-remove-confirm-btn'))

    await waitFor(() => {
      expect(apiClient.removeProfileImage).toHaveBeenCalledTimes(1)
      expect(refreshUser).toHaveBeenCalledTimes(1)
    })
  })

  it('[P1] renders initials when no profile image is present', () => {
    renderProfilePage({
      ...createMockAuthForRole('EMPLOYEE'),
      user: { ...mockUsers.employee, profileImageUrl: undefined },
    })

    expect(screen.getByTestId('profile-image-initials')).toHaveTextContent('SC')
  })

  it('[P1] uses a two-card profile layout with summary and image controls', () => {
    renderProfilePage(createMockAuthForRole('EMPLOYEE'))

    const layout = screen.getByTestId('profile-page').querySelector('.profile-layout')
    expect(layout).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Profile summary' })).toHaveClass('profile-summary-card')
    expect(screen.getByRole('region', { name: 'Profile photo' })).toHaveClass('profile-image-card')
    expect(screen.getByTestId('profile-image-input')).toBeInTheDocument()
  })

  it('[P1] renders null-safe profile fields for platform admin', () => {
    renderProfilePage(createMockAuthForRole('PLATFORM_ADMIN'))

    expect(screen.getByText('Riley Morgan')).toBeInTheDocument()
    expect(screen.getByText('Platform Admin')).toBeInTheDocument()
    expect(screen.getAllByText('Not applicable')).toHaveLength(2)
    expect(screen.getByText('Not set')).toBeInTheDocument()
  })

  it('[P2] shows localized preferred language label from i18n keys', () => {
    renderProfilePage({
      ...createMockAuthForRole('EMPLOYEE'),
      user: { ...mockUsers.employee, preferredLanguage: 'ar' },
    })

    expect(screen.getByText('العربية')).toBeInTheDocument()
  })

  describe('personal notifications and integrations (Plan PUENTE D-12)', () => {
    it('[P0] an employee reaches their notification preferences and calendar cards from Profile', async () => {
      renderProfilePage(createMockAuthForRole('EMPLOYEE'))

      const notifications = screen.getByTestId('profile-notifications-section')
      expect(within(notifications).getByRole('heading', { name: 'Notifications' })).toBeInTheDocument()
      expect(await within(notifications).findByTestId('notification-preferences-settings')).toBeInTheDocument()

      const integrations = screen.getByTestId('profile-integrations-section')
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

      renderProfilePage(createMockAuthForRole('EMPLOYEE'))

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
      renderProfilePage(createMockAuthForRole('EMPLOYEE'), '/profile?calendarSync=connected')

      expect(
        await screen.findByText('Calendar connected. Approved leave will now appear on your calendar.'),
      ).toBeInTheDocument()
      expect(
        screen.getAllByText('Calendar connected. Approved leave will now appear on your calendar.'),
      ).toHaveLength(1)
    })

    it('[P1] warns when the user declined calendar consent on the OAuth callback', async () => {
      renderProfilePage(createMockAuthForRole('EMPLOYEE'), '/profile?calendarSync=error&reason=access_denied')

      expect(
        await screen.findByText('Calendar connection was cancelled before access was granted.'),
      ).toBeInTheDocument()
    })

    it('[P2] hides the personal sections from a Platform Admin', () => {
      renderProfilePage(createMockAuthForRole('PLATFORM_ADMIN'))

      expect(screen.queryByTestId('profile-notifications-section')).not.toBeInTheDocument()
      expect(screen.queryByTestId('profile-integrations-section')).not.toBeInTheDocument()
      expect(apiClient.getCalendarSyncStatus).not.toHaveBeenCalled()
    })
  })
})
