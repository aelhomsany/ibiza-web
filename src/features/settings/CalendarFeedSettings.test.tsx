import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../api/client'
import { CalendarFeedNotes, CalendarFeedSettings } from './CalendarFeedSettings'

const FEED_URL = 'http://localhost:8080/api/v1/calendar-feeds/opaque-token.ics'

function renderCard(onSuccess = vi.fn(), onWarning = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CalendarFeedSettings onSuccess={onSuccess} onWarning={onWarning} />
    </QueryClientProvider>,
  )
}

describe('CalendarFeedSettings', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows the not-created state with only a Create action', async () => {
    vi.spyOn(apiClient, 'getCalendarFeed').mockResolvedValue({ active: false })

    renderCard()

    expect(await screen.findByTestId('calendar-feed-status')).toHaveTextContent('Not created')
    expect(screen.getByTestId('calendar-feed-create')).toBeInTheDocument()
    expect(screen.queryByTestId('calendar-feed-rotate')).not.toBeInTheDocument()
    expect(screen.queryByTestId('calendar-feed-remove')).not.toBeInTheDocument()
    expect(screen.queryByTestId('calendar-feed-link')).not.toBeInTheDocument()
    render(<CalendarFeedNotes />)
    expect(screen.getByText('How to subscribe')).toBeInTheDocument()
  })

  it('creates a link, shows the URL once and copies it to the clipboard', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...window.navigator, clipboard: { writeText } })
    const onSuccess = vi.fn()
    const getFeed = vi
      .spyOn(apiClient, 'getCalendarFeed')
      .mockResolvedValueOnce({ active: false })
      .mockResolvedValue({ active: true, createdAt: '2026-09-03T08:00:00Z', lastAccessedAt: null })
    vi.spyOn(apiClient, 'createCalendarFeed').mockResolvedValue({ url: FEED_URL })

    renderCard(onSuccess)

    await user.click(await screen.findByTestId('calendar-feed-create'))

    const urlField = await screen.findByTestId('calendar-feed-url')
    expect(urlField).toHaveValue(FEED_URL)
    expect(screen.getByText(/shown only once/)).toBeInTheDocument()
    expect(onSuccess).toHaveBeenCalledWith('Calendar feed link created')
    await waitFor(() => expect(getFeed).toHaveBeenCalledTimes(2))
    expect(await screen.findByTestId('calendar-feed-status')).toHaveTextContent('Active since')
    expect(screen.getByTestId('calendar-feed-status')).toHaveTextContent('not fetched yet')

    await user.click(screen.getByTestId('calendar-feed-copy'))
    expect(writeText).toHaveBeenCalledWith(FEED_URL)
    expect(await screen.findByTestId('calendar-feed-copy')).toHaveTextContent('Copied')
    expect(onSuccess).toHaveBeenCalledWith('Link copied to clipboard')
  })

  it('warns and selects the URL when the clipboard is unavailable', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('navigator', {
      ...window.navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    const onWarning = vi.fn()
    vi.spyOn(apiClient, 'getCalendarFeed').mockResolvedValue({ active: false })
    vi.spyOn(apiClient, 'createCalendarFeed').mockResolvedValue({ url: FEED_URL })

    renderCard(vi.fn(), onWarning)
    await user.click(await screen.findByTestId('calendar-feed-create'))
    await user.click(await screen.findByTestId('calendar-feed-copy'))

    await waitFor(() => expect(onWarning).toHaveBeenCalledWith(expect.stringContaining('Could not copy')))
    expect(screen.getByTestId('calendar-feed-copy')).toHaveTextContent('Copy link')
    expect(screen.getByTestId('calendar-feed-url')).toHaveFocus()
  })

  it('shows the active state with last fetch and never shows a URL it did not just mint', async () => {
    vi.spyOn(apiClient, 'getCalendarFeed').mockResolvedValue({
      active: true,
      createdAt: '2026-09-01T08:00:00Z',
      lastAccessedAt: '2026-09-03T06:30:00Z',
    })

    renderCard()

    const status = await screen.findByTestId('calendar-feed-status')
    expect(status).toHaveTextContent('Active since')
    expect(status).toHaveTextContent('last fetched')
    expect(screen.getByTestId('calendar-feed-rotate')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-feed-remove')).toBeInTheDocument()
    expect(screen.queryByTestId('calendar-feed-create')).not.toBeInTheDocument()
    expect(screen.queryByTestId('calendar-feed-url')).not.toBeInTheDocument()
  })

  it('rotates only after confirmation and shows the replacement URL', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    vi.spyOn(apiClient, 'getCalendarFeed').mockResolvedValue({
      active: true,
      createdAt: '2026-09-01T08:00:00Z',
      lastAccessedAt: null,
    })
    const create = vi.spyOn(apiClient, 'createCalendarFeed').mockResolvedValue({ url: FEED_URL })

    renderCard(onSuccess)
    await user.click(await screen.findByTestId('calendar-feed-rotate'))

    expect(await screen.findByTestId('calendar-feed-confirm-modal')).toBeInTheDocument()
    expect(screen.getByText('Create a new link?')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('calendar-feed-confirm'))

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(await screen.findByTestId('calendar-feed-url')).toHaveValue(FEED_URL)
    expect(screen.queryByTestId('calendar-feed-confirm-modal')).not.toBeInTheDocument()
    expect(onSuccess).toHaveBeenCalledWith(expect.stringContaining('previous link no longer works'))
  })

  it('removes only after confirmation and drops back to the not-created state', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    vi.spyOn(apiClient, 'getCalendarFeed')
      .mockResolvedValueOnce({ active: true, createdAt: '2026-09-01T08:00:00Z', lastAccessedAt: null })
      .mockResolvedValue({ active: false })
    const remove = vi.spyOn(apiClient, 'deleteCalendarFeed').mockResolvedValue(undefined)

    renderCard(onSuccess)
    await user.click(await screen.findByTestId('calendar-feed-remove'))
    expect(screen.getByText('Remove the calendar feed?')).toBeInTheDocument()
    await user.click(screen.getByTestId('calendar-feed-confirm'))

    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1))
    expect(await screen.findByTestId('calendar-feed-status')).toHaveTextContent('Not created')
    expect(onSuccess).toHaveBeenCalledWith('Calendar feed removed')
  })

  it('surfaces a create failure through onWarning', async () => {
    const user = userEvent.setup()
    const onWarning = vi.fn()
    vi.spyOn(apiClient, 'getCalendarFeed').mockResolvedValue({ active: false })
    vi.spyOn(apiClient, 'createCalendarFeed').mockRejectedValue(
      new apiClient.ApiError(503, { status: 503, title: 'Unavailable', detail: 'Feed store is down' }),
    )

    renderCard(vi.fn(), onWarning)
    await user.click(await screen.findByTestId('calendar-feed-create'))

    await waitFor(() => expect(onWarning).toHaveBeenCalledWith('Feed store is down'))
    expect(screen.queryByTestId('calendar-feed-url')).not.toBeInTheDocument()
  })

  it('shows a load error state', async () => {
    vi.spyOn(apiClient, 'getCalendarFeed').mockRejectedValue(new Error('boom'))

    renderCard()

    expect(await screen.findByText('Unable to load calendar feed status.')).toBeInTheDocument()
  })
})
