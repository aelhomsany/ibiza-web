import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { ScheduleAssignmentModal, type ScheduleVersionOption } from './ScheduleAssignmentModal'
import type { LocationContextResponse } from '../../api/generated/types'
import type { components } from '../../api/generated/types'

type NamedTarget = components['schemas']['NamedTarget']

const versionOptions: ScheduleVersionOption[] = [
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

const workforceGroups: NamedTarget[] = [{ publicId: 'group-1', name: 'Default Group' }]
const users: NamedTarget[] = [{ publicId: 'user-1', name: 'Jane Doe' }]

function renderModal() {
  return render(
    <ScheduleAssignmentModal
      versionOptions={versionOptions}
      locations={locations}
      workforceGroups={workforceGroups}
      users={users}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      onWarning={vi.fn()}
    />,
  )
}

describe('ScheduleAssignmentModal', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Spec Testing & Validation (SPA-only): the server does not require every
  // field to be filled before a preview call is even attempted -- this is a
  // client-side UX guard so a user can never fire an incomplete request.
  it('modal guards zero-selection submit', () => {
    const previewSpy = vi.spyOn(apiClient, 'previewScheduleAssignment')

    renderModal()

    const previewButton = screen.getByTestId('schedule-assignment-preview-submit')
    // Scope defaults to Organization (no subject needed), but scheduleVersion,
    // location, and effectiveFrom are all still blank.
    expect(previewButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/schedule version/i), { target: { value: 'version-1' } })
    expect(previewButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/^location$/i), { target: { value: 'location-1' } })
    expect(previewButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/effective from/i), { target: { value: '2027-01-01' } })
    expect(previewButton).toBeEnabled()

    expect(previewSpy).not.toHaveBeenCalled()
  })

  // Spec Testing & Validation (SPA-only): an Organization admin must see the resolved
  // affected-member impact before Confirm ever becomes reachable, and any
  // later field change must invalidate that resolved preview again.
  it('confirm button disabled until preview resolves', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'previewScheduleAssignment').mockResolvedValue({
      scope: 'ORGANIZATION',
      scheduleVersionPublicId: 'version-1',
      locationPublicId: 'location-1',
      effectiveFrom: '2027-01-01',
      affectedMemberCount: 3,
      members: [],
    })

    renderModal()

    const confirmButton = screen.getByTestId('schedule-assignment-confirm-submit')
    expect(confirmButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/schedule version/i), { target: { value: 'version-1' } })
    fireEvent.change(screen.getByLabelText(/^location$/i), { target: { value: 'location-1' } })
    fireEvent.change(screen.getByLabelText(/effective from/i), { target: { value: '2027-01-01' } })
    expect(confirmButton).toBeDisabled()

    await user.click(screen.getByTestId('schedule-assignment-preview-submit'))

    await waitFor(() => {
      expect(confirmButton).toBeEnabled()
    })
    expect(screen.getByTestId('schedule-assignment-affected-count')).toHaveTextContent('3')

    // Changing a field after a resolved preview must invalidate it again --
    // the guard is "the CURRENT selection was just previewed", not "a preview
    // has ever happened".
    fireEvent.change(screen.getByLabelText(/^location$/i), { target: { value: 'location-1' } })
    expect(confirmButton).toBeDisabled()
  })
})
