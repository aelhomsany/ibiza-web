import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../api/client'
import type { ChatWebhookResponse } from '../../api/generated/types'
import type { UserRole } from '../../api/generated/types'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { ChatNotificationsSettings } from './ChatNotificationsSettings'

const slackChannel: ChatWebhookResponse = {
  id: 7,
  provider: 'SLACK',
  label: '#people-ops',
  urlHost: 'hooks.slack.com',
  postDailyDigest: true,
  digestLocalTime: '08:30',
  postApprovals: false,
  status: 'ACTIVE',
  lastErrorCategory: null,
  lastPostedAt: null,
}

function renderCard(role: UserRole = 'HR_ADMIN', onSuccess = vi.fn(), onWarning = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole(role)}>
        <ChatNotificationsSettings onSuccess={onSuccess} onWarning={onWarning} />
      </AuthTestProvider>
    </QueryClientProvider>,
  )
}

describe('ChatNotificationsSettings', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each(['EMPLOYEE', 'MANAGER'] as UserRole[])('renders nothing for %s and never lists channels', (role) => {
    const list = vi.spyOn(apiClient, 'getChatWebhooks').mockResolvedValue([slackChannel])

    renderCard(role)

    expect(screen.queryByTestId('chat-notifications-settings')).not.toBeInTheDocument()
    expect(list).not.toHaveBeenCalled()
  })

  it('shows each channel as host and status, never the webhook URL', async () => {
    vi.spyOn(apiClient, 'getChatWebhooks').mockResolvedValue([
      slackChannel,
      {
        ...slackChannel,
        id: 8,
        provider: 'TEAMS',
        label: 'Leadership',
        urlHost: 'contoso.webhook.office.com',
        status: 'ERROR',
        lastErrorCategory: 'WEBHOOK_REVOKED',
        lastPostedAt: '2026-09-01T05:30:00Z',
        postApprovals: true,
      },
    ])

    renderCard()

    expect(await screen.findByTestId('chat-webhook-host-7')).toHaveTextContent('hooks.slack.com')
    expect(screen.getByTestId('chat-webhook-status-7')).toHaveTextContent('Active')
    expect(screen.getAllByText('Daily digest at 08:30')).toHaveLength(2)
    expect(screen.getByTestId('chat-webhook-status-8')).toHaveTextContent('Needs attention')
    expect(screen.getByText(/Error category: WEBHOOK_REVOKED/)).toBeInTheDocument()
    expect(screen.getByText('Announces approved leave')).toBeInTheDocument()
    expect(screen.getByText('Microsoft Teams')).toBeInTheDocument()
  })

  it('refuses a non-https webhook URL before any request is made', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getChatWebhooks').mockResolvedValue([])
    const create = vi.spyOn(apiClient, 'createChatWebhook').mockResolvedValue(slackChannel)

    renderCard()
    await user.click(await screen.findByTestId('chat-webhook-add'))
    await user.type(screen.getByLabelText('Channel label'), '#people-ops')
    await user.type(screen.getByLabelText('Incoming webhook URL'), 'http://hooks.slack.com/services/T/B/x')
    await user.click(screen.getByTestId('chat-webhook-save'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Webhook URL must start with https://')
    expect(create).not.toHaveBeenCalled()
  })

  it('creates a channel with the typed URL and then only ever shows its host', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    const list = vi.spyOn(apiClient, 'getChatWebhooks').mockResolvedValueOnce([]).mockResolvedValue([slackChannel])
    const create = vi.spyOn(apiClient, 'createChatWebhook').mockResolvedValue(slackChannel)

    renderCard('HR_ADMIN', onSuccess)
    await user.click(await screen.findByTestId('chat-webhook-add'))
    await user.type(screen.getByLabelText('Channel label'), '#people-ops')
    await user.type(
      screen.getByLabelText('Incoming webhook URL'),
      'https://hooks.slack.com/services/T000/B000/secret-path',
    )
    await user.click(screen.getByLabelText('Announce approved leave'))
    await user.click(screen.getByTestId('chat-webhook-save'))

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        provider: 'SLACK',
        label: '#people-ops',
        url: 'https://hooks.slack.com/services/T000/B000/secret-path',
        postDailyDigest: true,
        digestLocalTime: '08:30',
        postApprovals: true,
      })
    })
    expect(onSuccess).toHaveBeenCalledWith('Chat channel added')
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    expect(await screen.findByTestId('chat-webhook-host-7')).toHaveTextContent('hooks.slack.com')
    expect(screen.queryByText(/secret-path/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('chat-webhook-form-modal')).not.toBeInTheDocument()
  })

  it('surfaces the server rejection inside the form', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getChatWebhooks').mockResolvedValue([])
    vi.spyOn(apiClient, 'createChatWebhook').mockRejectedValue(
      new apiClient.ApiError(400, {
        type: 'https://ibiza.app/errors/validation-failed',
        title: 'Validation failed',
        status: 400,
        detail: 'Webhook URL host is not a Slack webhook host',
      }),
    )

    renderCard()
    await user.click(await screen.findByTestId('chat-webhook-add'))
    await user.type(screen.getByLabelText('Channel label'), '#ops')
    await user.type(screen.getByLabelText('Incoming webhook URL'), 'https://evil.example.com/x')
    await user.click(screen.getByTestId('chat-webhook-save'))

    expect(await screen.findByTestId('chat-webhook-form-error')).toHaveTextContent(
      'Webhook URL host is not a Slack webhook host',
    )
    expect(screen.getByTestId('chat-webhook-form-modal')).toBeInTheDocument()
  })

  it('sends a test message and reports the provider category when it fails', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    const onWarning = vi.fn()
    vi.spyOn(apiClient, 'getChatWebhooks').mockResolvedValue([slackChannel])
    const test = vi
      .spyOn(apiClient, 'testChatWebhook')
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new apiClient.ApiError(502, {
          type: 'https://ibiza.app/errors/chat-provider-failed',
          title: 'Chat provider failed',
          status: 502,
          detail: 'The chat provider did not accept the test message',
          category: 'WEBHOOK_REVOKED',
        } as never),
      )

    renderCard('HR_ADMIN', onSuccess, onWarning)
    await user.click(await screen.findByTestId('chat-webhook-test-7'))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('Test message sent'))

    await user.click(screen.getByTestId('chat-webhook-test-7'))
    await waitFor(() =>
      expect(onWarning).toHaveBeenCalledWith(
        'The chat provider did not accept the test message (WEBHOOK_REVOKED)',
      ),
    )
    expect(test).toHaveBeenCalledTimes(2)
  })

  it('removes a channel only after confirmation', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    vi.spyOn(apiClient, 'getChatWebhooks').mockResolvedValueOnce([slackChannel]).mockResolvedValue([])
    const remove = vi.spyOn(apiClient, 'deleteChatWebhook').mockResolvedValue(undefined)

    renderCard('HR_ADMIN', onSuccess)
    await user.click(await screen.findByTestId('chat-webhook-remove-7'))
    expect(screen.getByTestId('chat-webhook-remove-modal')).toHaveTextContent('#people-ops')
    expect(remove).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('chat-webhook-confirm-remove'))

    await waitFor(() => expect(remove).toHaveBeenCalledWith(7))
    expect(onSuccess).toHaveBeenCalledWith('Chat channel removed')
    await waitFor(() => expect(screen.queryByTestId('chat-webhook-7')).not.toBeInTheDocument())
    expect(screen.getByText('No chat channels connected yet.')).toBeInTheDocument()
  })
})
