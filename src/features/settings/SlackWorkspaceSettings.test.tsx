import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../api/client'
import type { SlackStatusResponse, UserRole } from '../../api/generated/types'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { SlackWorkspaceSettings } from './SlackWorkspaceSettings'

const notConnected: SlackStatusResponse = {
  workspaceConnected: false,
  status: null,
  teamName: null,
  installedAt: null,
  lastErrorCategory: null,
  me: { linked: false, status: 'UNCHECKED' },
}

const connected: SlackStatusResponse = {
  workspaceConnected: true,
  status: 'CONNECTED',
  teamName: 'Acme Workspace',
  installedAt: '2026-09-03T08:00:00Z',
  lastErrorCategory: null,
  me: { linked: true, status: 'LINKED' },
}

function renderCard(role: UserRole = 'HR_ADMIN', onSuccess = vi.fn(), onWarning = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole(role)}>
        <SlackWorkspaceSettings onSuccess={onSuccess} onWarning={onWarning} />
      </AuthTestProvider>
    </QueryClientProvider>,
  )
}

describe('SlackWorkspaceSettings', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it.each(['EMPLOYEE', 'MANAGER'] as UserRole[])(
    'tells a %s the app is not connected without offering to install it',
    async (role) => {
      vi.spyOn(apiClient, 'getSlackStatus').mockResolvedValue(notConnected)

      renderCard(role)

      expect(await screen.findByTestId('slack-workspace-copy')).toHaveTextContent(
        'Your HR admin has not connected the Slack app yet',
      )
      expect(screen.queryByTestId('slack-workspace-install')).not.toBeInTheDocument()
      expect(screen.queryByTestId('slack-me-row')).not.toBeInTheDocument()
    },
  )

  it('sends an HR Admin to Slack via the API-issued authorization URL', async () => {
    const user = userEvent.setup()
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    vi.spyOn(apiClient, 'getSlackStatus').mockResolvedValue(notConnected)
    const install = vi
      .spyOn(apiClient, 'installSlack')
      .mockResolvedValue({ authorizationUrl: 'https://slack.com/oauth/v2/authorize?state=abc' })

    renderCard()

    await user.click(await screen.findByRole('button', { name: 'Add to Slack' }))

    await waitFor(() => {
      expect(install).toHaveBeenCalledTimes(1)
      expect(assign).toHaveBeenCalledWith('https://slack.com/oauth/v2/authorize?state=abc')
    })
  })

  it('shows the workspace and lets an HR Admin disconnect it after confirming', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    vi.spyOn(apiClient, 'getSlackStatus').mockResolvedValue(connected)
    const disconnect = vi.spyOn(apiClient, 'disconnectSlack').mockResolvedValue(undefined)

    renderCard('HR_ADMIN', onSuccess)

    expect(await screen.findByTestId('slack-workspace-team')).toHaveTextContent('Connected to Acme Workspace')
    expect(screen.getByTestId('slack-workspace-status')).toHaveTextContent('Connected')
    // The personal "Your Slack" row lives on the My settings page (SlackLinkSettings), not here.
    expect(screen.queryByTestId('slack-me-row')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('slack-workspace-disconnect'))
    expect(screen.getByTestId('slack-disconnect-modal')).toHaveTextContent(
      'Ibiza will uninstall its app from Acme Workspace',
    )
    expect(disconnect).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('slack-workspace-confirm-disconnect'))

    await waitFor(() => {
      expect(disconnect).toHaveBeenCalledTimes(1)
      expect(onSuccess).toHaveBeenCalledWith('Slack app disconnected')
    })
  })

  it('shows a revoked workspace with its error category and offers an HR Admin a reconnect', async () => {
    const user = userEvent.setup()
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    vi.spyOn(apiClient, 'getSlackStatus').mockResolvedValue({
      ...connected,
      workspaceConnected: false,
      status: 'REVOKED',
      lastErrorCategory: 'token_revoked',
      me: { linked: false, status: 'UNCHECKED' },
    })
    const install = vi
      .spyOn(apiClient, 'installSlack')
      .mockResolvedValue({ authorizationUrl: 'https://slack.com/oauth/v2/authorize?state=again' })

    renderCard()

    expect(await screen.findByTestId('slack-workspace-copy')).toHaveTextContent(
      "Slack revoked the app's access (token_revoked)",
    )
    expect(screen.getByTestId('slack-workspace-status')).toHaveTextContent('Access revoked')
    expect(screen.queryByTestId('slack-workspace-disconnect')).not.toBeInTheDocument()
    expect(screen.queryByTestId('slack-me-row')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reconnect' }))

    await waitFor(() => {
      expect(install).toHaveBeenCalledTimes(1)
      expect(assign).toHaveBeenCalledWith('https://slack.com/oauth/v2/authorize?state=again')
    })
  })

  it('surfaces the API problem detail when the install cannot start', async () => {
    const user = userEvent.setup()
    const onWarning = vi.fn()
    vi.spyOn(apiClient, 'getSlackStatus').mockResolvedValue(notConnected)
    vi.spyOn(apiClient, 'installSlack').mockRejectedValue(
      new apiClient.ApiError(400, { title: 'Bad Request', status: 400, detail: 'Slack app is not configured' }),
    )

    renderCard('HR_ADMIN', vi.fn(), onWarning)

    await user.click(await screen.findByRole('button', { name: 'Add to Slack' }))

    await waitFor(() => {
      expect(onWarning).toHaveBeenCalledWith('Slack app is not configured')
    })
  })
})
