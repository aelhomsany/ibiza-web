import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../api/client'
import type { NotificationPreferenceResponse } from '../../api/generated/types'
import { NotificationPreferencesSettings } from './NotificationPreferencesSettings'

const defaultPreferences: NotificationPreferenceResponse[] = [
  {
    channel: 'IN_APP',
    scope: 'WORKFLOW',
    mandatory: true,
    enabled: true,
    mutedUntil: null,
    effectiveEnabledNow: true,
  },
  {
    channel: 'EMAIL',
    scope: 'WORKFLOW',
    mandatory: false,
    enabled: true,
    mutedUntil: null,
    effectiveEnabledNow: true,
  },
]

function renderCard(onSuccess = vi.fn(), onWarning = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationPreferencesSettings onSuccess={onSuccess} onWarning={onWarning} />
    </QueryClientProvider>,
  )
}

describe('NotificationPreferencesSettings', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('labels mandatory in-app workflow delivery and keeps it locked', async () => {
    vi.spyOn(apiClient, 'getNotificationPreferences').mockResolvedValue(defaultPreferences)

    renderCard()

    const inAppRow = await screen.findByTestId('notification-preference-in-app-workflow')
    expect(within(inAppRow).getByText(/required/i)).toBeInTheDocument()
    expect(within(inAppRow).getByText(/workflow accountability/i)).toBeInTheDocument()
    expect(
      within(inAppRow).getByRole('checkbox', { name: /in-app workflow/i }),
    ).toBeDisabled()
  })

  it('saves the mutable email preference through the API client and shared toast callback', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    vi.spyOn(apiClient, 'getNotificationPreferences').mockResolvedValue(defaultPreferences)
    const updateSpy = vi
      .spyOn(apiClient, 'updateNotificationPreference')
      .mockResolvedValue([
        defaultPreferences[0],
        { ...defaultPreferences[1], enabled: false, effectiveEnabledNow: false },
      ])

    renderCard(onSuccess)

    await user.click(await screen.findByRole('checkbox', { name: /email workflow/i }))
    await user.click(screen.getByRole('button', { name: 'Save Preferences' }))

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        channel: 'EMAIL',
        scope: 'WORKFLOW',
        enabled: false,
        mutedUntil: null,
      })
      expect(onSuccess).toHaveBeenCalledWith('Notification preferences saved')
    })
  })

  it('mutes and clears mutable email delivery with text-labelled controls', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getNotificationPreferences').mockResolvedValue(defaultPreferences)
    const updateSpy = vi
      .spyOn(apiClient, 'updateNotificationPreference')
      .mockResolvedValue(defaultPreferences)

    renderCard()

    await user.selectOptions(await screen.findByLabelText(/mute email workflow/i), '1_DAY')
    await user.click(screen.getByRole('button', { name: 'Mute Email' }))
    await user.click(screen.getByRole('button', { name: 'Clear Mute' }))

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'EMAIL',
          scope: 'WORKFLOW',
          enabled: true,
          mutedUntil: expect.any(String),
        }),
      )
      expect(updateSpy).toHaveBeenCalledWith({
        channel: 'EMAIL',
        scope: 'WORKFLOW',
        enabled: true,
        mutedUntil: null,
      })
    })
  })

  it('mutes using the currently displayed (unsaved) enabled state instead of forcing it on', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getNotificationPreferences').mockResolvedValue(defaultPreferences)
    const updateSpy = vi
      .spyOn(apiClient, 'updateNotificationPreference')
      .mockResolvedValue(defaultPreferences)

    renderCard()

    await user.click(await screen.findByRole('checkbox', { name: /email workflow/i }))
    await user.click(screen.getByRole('button', { name: 'Mute Email' }))

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'EMAIL', scope: 'WORKFLOW', enabled: false }),
      )
    })
  })

  it('does not let a background refetch clobber an unsaved email preference edit', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const getSpy = vi.spyOn(apiClient, 'getNotificationPreferences').mockResolvedValue(defaultPreferences)

    render(
      <QueryClientProvider client={queryClient}>
        <NotificationPreferencesSettings />
      </QueryClientProvider>,
    )

    const emailCheckbox = await screen.findByRole('checkbox', { name: /email workflow/i })
    await user.click(emailCheckbox)
    expect(emailCheckbox).not.toBeChecked()

    await queryClient.refetchQueries({ queryKey: ['notification-preferences'] })
    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(2))

    expect(emailCheckbox).not.toBeChecked()
  })

  it('reverts the email preference edit to server truth when the save is rejected', async () => {
    const user = userEvent.setup()
    const onWarning = vi.fn()
    vi.spyOn(apiClient, 'getNotificationPreferences').mockResolvedValue(defaultPreferences)
    vi.spyOn(apiClient, 'updateNotificationPreference').mockRejectedValue(new Error('save failed'))

    renderCard(vi.fn(), onWarning)

    const emailCheckbox = await screen.findByRole('checkbox', { name: /email workflow/i })
    await user.click(emailCheckbox)
    await user.click(screen.getByRole('button', { name: 'Save Preferences' }))

    await waitFor(() => expect(onWarning).toHaveBeenCalled())
    expect(emailCheckbox).toBeChecked()
  })

  // The panel is two checkboxes and a mute control; nothing on it says what a "workflow
  // notification" IS, or that these choices are the reader's own. The rail carries the four
  // NotificationType values the server actually sends, and the three limits it enforces.
  it('names what workflow notifications cover and whose settings these are', async () => {
    vi.spyOn(apiClient, 'getNotificationPreferences').mockResolvedValue(defaultPreferences)

    renderCard()

    const rail = await screen.findByRole('complementary')
    const sent = within(rail).getByRole('list')
    expect(within(sent).getAllByRole('listitem')).toHaveLength(4)

    // The three rules the API enforces regardless of what this panel is set to.
    expect(rail).toHaveTextContent(/These preferences are yours alone/)
    expect(rail).toHaveTextContent(/In-app workflow notifications are required and cannot be turned off/)
    expect(rail).toHaveTextContent(/An email mute can run for at most 30 days/)
  })
})
