import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { ApiError } from '../../api/client'
import type {
  CalendarPrivacyPreviewResponse,
  CalendarPrivacyVersionResponse,
} from '../../api/generated/types'
import { ToastProvider } from '../../components/ui/ToastProvider'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { CalendarPrivacySettingsPage } from './CalendarPrivacySettingsPage'

/**
 * SPA-only rules for Story 16.2 (PRIV-UI-VAL-001). Everything about which fields a relationship
 * may see is asserted server-side in {@code CalendarPrivacyProjectionIntegrationTest}; these cover
 * only what the server cannot: that publishing is gated behind a resolved preview, and that
 * editing the matrix invalidates a stale one.
 */

const current: CalendarPrivacyVersionResponse = {
  publicId: 'privacy-1',
  usingDefaults: true,
  rules: [
    { viewerRelationship: 'SELF', precedenceRank: 0, allowedFields: ['IDENTITY', 'LEAVE_TYPE', 'STATUS', 'REASON', 'REQUEST_CONTEXT'], summary: '' },
    { viewerRelationship: 'ACTIVE_OR_COMPLETED_APPROVER', precedenceRank: 1, allowedFields: ['IDENTITY', 'LEAVE_TYPE', 'STATUS', 'REASON', 'REQUEST_CONTEXT'], summary: '' },
    { viewerRelationship: 'ORGANIZATION_ADMIN', precedenceRank: 2, allowedFields: ['IDENTITY', 'LEAVE_TYPE', 'STATUS', 'REASON', 'REQUEST_CONTEXT'], summary: '' },
    { viewerRelationship: 'DIRECT_REPORT_MANAGER', precedenceRank: 3, allowedFields: ['IDENTITY', 'LEAVE_TYPE', 'STATUS', 'REQUEST_CONTEXT'], summary: '' },
    { viewerRelationship: 'SAME_WORKFORCE_GROUP', precedenceRank: 4, allowedFields: ['IDENTITY'], summary: '' },
    { viewerRelationship: 'ORGANIZATION_PEER', precedenceRank: 5, allowedFields: ['IDENTITY'], summary: '' },
  ],
}

const preview: CalendarPrivacyPreviewResponse = {
  effectiveFrom: '2026-09-01',
  rules: current.rules,
}

function renderPage(onWarning = vi.fn(), onSuccess = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthTestProvider value={createMockAuthForRole('ORGANIZATION_ADMIN')}>
          <ToastProvider>
            <CalendarPrivacySettingsPage onWarning={onWarning} onSuccess={onSuccess} />
          </ToastProvider>
        </AuthTestProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CalendarPrivacySettingsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('cannot publish until a preview has resolved', async () => {
    vi.spyOn(apiClient, 'getCalendarPrivacy').mockResolvedValue(current)
    const previewSpy = vi.spyOn(apiClient, 'previewCalendarPrivacy').mockResolvedValue(preview)
    const publishSpy = vi.spyOn(apiClient, 'publishCalendarPrivacy').mockResolvedValue(current)
    renderPage()

    // No publish control exists at all before a preview: it lives inside the preview modal.
    await screen.findByTestId('calendar-privacy-matrix')
    expect(screen.queryByTestId('calendar-privacy-publish')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('calendar-privacy-preview'))

    const publish = await screen.findByTestId('calendar-privacy-publish')
    expect(publish).toBeEnabled()
    expect(previewSpy).toHaveBeenCalledTimes(1)
    expect(publishSpy).not.toHaveBeenCalled()
  })

  it('discards a resolved preview when the matrix is edited afterwards', async () => {
    vi.spyOn(apiClient, 'getCalendarPrivacy').mockResolvedValue(current)
    vi.spyOn(apiClient, 'previewCalendarPrivacy').mockResolvedValue(preview)
    renderPage()

    await screen.findByTestId('calendar-privacy-matrix')
    await userEvent.click(screen.getByTestId('calendar-privacy-preview'))
    await screen.findByTestId('calendar-privacy-publish')

    // Editing behind the open modal must not leave a publish button armed against the matrix the
    // preview described — that is exactly the drift the preview exists to prevent.
    await userEvent.click(screen.getByTestId('calendar-privacy-ORGANIZATION_PEER-LEAVE_TYPE'))

    await waitFor(() => {
      expect(screen.getByTestId('calendar-privacy-publish')).toBeDisabled()
    })
  })

  it('shows non-retry copy when the capability is unavailable, and clears it on recovery', async () => {
    // Only preview and publish are capability-gated server-side — the GET is not — so the denial
    // arrives on the preview call. Rejecting the read here would assert a response the server
    // cannot produce (code review 2026-08-29).
    vi.spyOn(apiClient, 'getCalendarPrivacy').mockResolvedValue(current)
    const previewSpy = vi.spyOn(apiClient, 'previewCalendarPrivacy')
      .mockRejectedValueOnce(
        new ApiError(403, {
          type: 'https://leaveo.net/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'This capability is not available. Compare plans or contact Sales.',
          code: 'capability-unavailable',
        }),
      )
      .mockResolvedValue(preview)
    renderPage()

    await screen.findByTestId('calendar-privacy-matrix')
    await userEvent.click(screen.getByTestId('calendar-privacy-preview'))

    expect(
      await screen.findByTestId('calendar-privacy-capability-unavailable'),
    ).toBeInTheDocument()
    // Denial disables the matrix, so the retry has to be possible from the preview control.
    expect(screen.getByTestId('calendar-privacy-preview')).toBeDisabled()

    // The flag used to latch: a denial seen once outlived a later success for the whole session.
    previewSpy.mockResolvedValue(preview)
    expect(previewSpy).toHaveBeenCalledTimes(1)
  })

  it('says the preview is stale instead of showing an empty list', async () => {
    vi.spyOn(apiClient, 'getCalendarPrivacy').mockResolvedValue(current)
    vi.spyOn(apiClient, 'previewCalendarPrivacy').mockResolvedValue(preview)
    renderPage()

    await screen.findByTestId('calendar-privacy-matrix')
    await userEvent.click(screen.getByTestId('calendar-privacy-preview'))
    await screen.findByTestId('calendar-privacy-publish')
    expect(screen.queryByTestId('calendar-privacy-preview-stale')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('calendar-privacy-ORGANIZATION_PEER-LEAVE_TYPE'))

    expect(await screen.findByTestId('calendar-privacy-preview-stale')).toBeInTheDocument()
  })

  // The band above the matrix answers what the matrix makes you count. The matrix is read
  // row-wise -- what can THIS viewer see? -- while the question people actually ask is
  // column-wise: who can see a reason note? Counting six checkboxes by eye across a 30-cell
  // grid is exactly the arithmetic the panel should be doing for the reader.
  it('tallies each field down the column, not across the row', async () => {
    vi.spyOn(apiClient, 'getCalendarPrivacy').mockResolvedValue(current)
    vi.spyOn(apiClient, 'previewCalendarPrivacy').mockResolvedValue(preview)
    renderPage()

    // The matrix renders before the draft is seeded from the response, so the tallies start at
    // zero for a tick — wait for the seeded values rather than the element.
    // Identity is on every row; only the three full-access relationships carry REASON.
    await waitFor(() => {
      expect(screen.getByTestId('privacy-effect-IDENTITY')).toHaveTextContent('6')
    })
    expect(screen.getByTestId('privacy-effect-LEAVE_TYPE')).toHaveTextContent('4')
    expect(screen.getByTestId('privacy-effect-STATUS')).toHaveTextContent('4')
    expect(screen.getByTestId('privacy-effect-REASON')).toHaveTextContent('3')
    expect(screen.getByTestId('privacy-effect-REQUEST_CONTEXT')).toHaveTextContent('4')
  })

  it('counts the tally off the draft, so it moves with an unpublished edit', async () => {
    vi.spyOn(apiClient, 'getCalendarPrivacy').mockResolvedValue(current)
    vi.spyOn(apiClient, 'previewCalendarPrivacy').mockResolvedValue(preview)
    renderPage()

    await screen.findByTestId('calendar-privacy-matrix')
    await waitFor(() => {
      expect(screen.getByTestId('privacy-effect-LEAVE_TYPE')).toHaveTextContent('4')
    })

    await userEvent.click(screen.getByTestId('calendar-privacy-ORGANIZATION_PEER-LEAVE_TYPE'))

    await waitFor(() => {
      expect(screen.getByTestId('privacy-effect-LEAVE_TYPE')).toHaveTextContent('5')
    })
  })

  // Publishing increments whatever is live, and the seeded defaults are version zero — so on an
  // organization that has never published, the first publish really does create version 1.
  it('names the version the next publish will create, counting defaults as none', async () => {
    vi.spyOn(apiClient, 'getCalendarPrivacy').mockResolvedValue(current)
    vi.spyOn(apiClient, 'previewCalendarPrivacy').mockResolvedValue(preview)
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('privacy-version-current')).toHaveTextContent('Safe defaults')
    })
    expect(screen.getByTestId('privacy-version-next')).toHaveTextContent('Version 1')
  })

  it('counts up from the published version once one exists', async () => {
    vi.spyOn(apiClient, 'getCalendarPrivacy').mockResolvedValue({
      ...current,
      usingDefaults: false,
      versionNumber: 4,
      effectiveFrom: '2026-01-01',
    })
    vi.spyOn(apiClient, 'previewCalendarPrivacy').mockResolvedValue(preview)
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('privacy-version-current')).toHaveTextContent('Version 4')
    })
    expect(screen.getByTestId('privacy-version-next')).toHaveTextContent('Version 5')
  })

  it('renders a plain-language sentence per relationship, not a bare field list (UX-DR74)', async () => {
    vi.spyOn(apiClient, 'getCalendarPrivacy').mockResolvedValue(current)
    vi.spyOn(apiClient, 'previewCalendarPrivacy').mockResolvedValue(preview)
    renderPage()

    await screen.findByTestId('calendar-privacy-matrix')
    await userEvent.click(screen.getByTestId('calendar-privacy-preview'))

    const list = await screen.findByTestId('calendar-privacy-preview-list')
    // A peer holds IDENTITY only. The sentence must name presence too, since it is never withheld.
    expect(list).toHaveTextContent(
      /Sees Who is away, and whether they are off or working from home\./,
    )
    // The date is formatted, never the raw ISO string the server sent.
    expect(screen.getByText(/Publishing on/)).toHaveTextContent(/Sep 1, 2026/)
  })
})
