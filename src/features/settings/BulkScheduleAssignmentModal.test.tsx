import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

function renderModal() {
  return render(
    <BulkScheduleAssignmentModal
      versionOptions={versionOptions}
      locations={locations}
      users={users}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      onWarning={vi.fn()}
    />,
  )
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
    vi.spyOn(apiClient, 'previewBulkScheduleAssignment').mockResolvedValue({
      scheduleVersionPublicId: 'version-1',
      locationPublicId: 'location-1',
      effectiveFrom: '2027-01-01',
      subjectCount: 2,
      affectedMemberCount: 2,
      conflicts: [],
    })

    renderModal()

    const confirmButton = screen.getByTestId('bulk-assignment-confirm-submit')
    expect(confirmButton).toBeDisabled()

    await user.click(screen.getByText('Jane Doe'))
    await user.click(screen.getByText('John Roe'))
    fireEvent.change(screen.getByLabelText(/schedule version/i), { target: { value: 'version-1' } })
    fireEvent.change(screen.getByLabelText(/^location$/i), { target: { value: 'location-1' } })
    fireEvent.change(screen.getByLabelText(/effective from/i), { target: { value: '2027-01-01' } })
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
})
