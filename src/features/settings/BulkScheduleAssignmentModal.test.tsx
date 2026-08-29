import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { BulkScheduleAssignmentModal, type BulkScheduleVersionOption } from './BulkScheduleAssignmentModal'
import type { LocationContextResponse } from '../../api/generated/types'
import type { components } from '../../api/generated/types'

type NamedTarget = components['schemas']['NamedTarget']

const versionOptions: BulkScheduleVersionOption[] = [
  { scheduleName: 'Standard', versionPublicId: 'version-1', versionNumber: 1 },
]

const locations: LocationContextResponse[] = [
  {
    locationPublicId: 'location-1',
    name: 'Cairo',
    code: '',
    country: '',
    region: '',
    ianaTimezone: 'Africa/Cairo',
    holidayWorkforceGroupPublicId: 'group-1',
  },
]

const users: NamedTarget[] = [
  { publicId: 'user-1', name: 'Jane Doe' },
  { publicId: 'user-2', name: 'John Roe' },
]

function renderModal(overrides: Partial<Parameters<typeof BulkScheduleAssignmentModal>[0]> = {}) {
  return render(
    <BulkScheduleAssignmentModal
      versionOptions={versionOptions}
      locations={locations}
      users={users}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      onWarning={vi.fn()}
      {...overrides}
    />,
  )
}

/** Fill in a complete, previewable selection: both people, the one version, the one location, a future date. */
async function selectWholeRoster(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('Jane Doe'))
  await user.click(screen.getByText('John Roe'))
  fireEvent.change(screen.getByLabelText(/schedule version/i), { target: { value: 'version-1' } })
  fireEvent.change(screen.getByLabelText(/^location$/i), { target: { value: 'location-1' } })
  fireEvent.change(screen.getByLabelText(/effective from/i), { target: { value: '2027-01-01' } })
}

const cleanPreview = {
  scheduleVersionPublicId: 'version-1',
  locationPublicId: 'location-1',
  effectiveFrom: '2027-01-01',
  subjectCount: 2,
  affectedMemberCount: 2,
  conflicts: [],
}

describe('BulkScheduleAssignmentModal', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // BULK-UI-VAL-001 (spec-16-4 Testing & Validation, SPA-only, P1): the Confirm button stays
  // disabled until a fresh Preview has resolved for the CURRENT selections -- mirrors
  // ScheduleAssignmentModal's single-assignment guard. The server does not require a preview
  // call before commit; this sequencing is a UX guard only.
  it('confirm disabled until preview resolves', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'previewBulkScheduleAssignment').mockResolvedValue(cleanPreview)

    renderModal()

    const confirmButton = screen.getByTestId('bulk-assignment-confirm-submit')
    expect(confirmButton).toBeDisabled()

    await selectWholeRoster(user)
    expect(confirmButton).toBeDisabled()

    await user.click(screen.getByTestId('bulk-assignment-preview-submit'))

    await waitFor(() => {
      expect(confirmButton).toBeEnabled()
    })
    expect(screen.getByTestId('bulk-assignment-affected-count')).toHaveTextContent('2')

    // Changing a selection after a resolved preview must invalidate it again -- the guard is
    // "the CURRENT selection was just previewed", not "a preview has ever happened".
    await user.click(screen.getByText('Jane Doe'))
    expect(confirmButton).toBeDisabled()
  })

  /**
   * BULK-UI-VAL-002 (code review 2026-08-30, SPA-only, P1). The suite stopped at the enablement
   * guard: nothing ever clicked Confirm, so `commitBulkScheduleAssignment` was never mocked and
   * the whole commit half of the modal -- the idempotency key minted by the preview, the success
   * toast, the close -- was uncovered. The key assertion is the load-bearing one: the commit must
   * reuse the key issued for the previewed batch, because that is what makes an accidental
   * double-confirm a replay rather than a second batch of assignment rows (AD-16).
   */
  it('commits with the idempotency key minted by the preview, then reports success and closes', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    const onWarning = vi.fn()
    vi.spyOn(apiClient, 'previewBulkScheduleAssignment').mockResolvedValue(cleanPreview)
    const commit = vi.spyOn(apiClient, 'commitBulkScheduleAssignment').mockResolvedValue({
      scheduleVersionPublicId: 'version-1',
      locationPublicId: 'location-1',
      effectiveFrom: '2027-01-01',
      subjectCount: 2,
      affectedMemberCount: 2,
    })

    renderModal({ onSuccess, onClose, onWarning })

    await selectWholeRoster(user)
    await user.click(screen.getByTestId('bulk-assignment-preview-submit'))
    const confirmButton = screen.getByTestId('bulk-assignment-confirm-submit')
    await waitFor(() => {
      expect(confirmButton).toBeEnabled()
    })

    await user.click(confirmButton)

    await waitFor(() => {
      expect(commit).toHaveBeenCalledTimes(1)
    })
    const [idempotencyKey, payload] = commit.mock.calls[0]
    expect(idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(payload).toEqual({
      subjectIds: ['user-1', 'user-2'],
      scheduleVersionPublicId: 'version-1',
      locationPublicId: 'location-1',
      effectiveFrom: '2027-01-01',
    })
    expect(onSuccess).toHaveBeenCalledWith('Assignments created for 2 people')
    expect(onClose).toHaveBeenCalled()
    expect(onWarning).not.toHaveBeenCalled()
  })

  /**
   * BULK-UI-VAL-003 (code review 2026-08-30, SPA-only, P1). Two bugs meet in this one list item.
   * The reason key is built by string concatenation from a server value, and it used to carry a
   * `defaultValue` -- which is inert here, because i18n's `parseMissingKeyHandler` returns '' and
   * beats it, so an unmapped reason rendered a silently blank bullet. And the member name is user
   * data interpolated into translated copy, so it needs `isolate()` rather than `dir="auto"`.
   * Asserting the text with the isolates stripped catches the first; asserting the isolates are
   * present catches the second. DUPLICATE_IN_BATCH is the reason added by this review, so it is
   * also the one with no prior coverage anywhere.
   */
  it('names the person in a conflict reason rather than rendering a blank bullet', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'previewBulkScheduleAssignment').mockResolvedValue({
      ...cleanPreview,
      subjectCount: 2,
      affectedMemberCount: 1,
      conflicts: [{ subjectId: 'user-1', reason: 'DUPLICATE_IN_BATCH' }],
    })

    renderModal()

    await selectWholeRoster(user)
    await user.click(screen.getByTestId('bulk-assignment-preview-submit'))

    const conflicts = await screen.findByTestId('bulk-assignment-conflicts')
    const item = within(conflicts).getByRole('listitem')
    // First strong isolate / pop directional isolate around the name only (src/i18n/bidi.ts).
    expect(item.textContent).toBe('⁨Jane Doe⁩ is selected more than once in this batch')
  })
})
