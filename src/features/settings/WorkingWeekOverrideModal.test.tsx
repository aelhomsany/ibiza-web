import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { WorkingWeekOverrideModal, type OverrideCandidate } from './WorkingWeekOverrideModal'

const people: OverrideCandidate[] = [
  { publicId: 'user-1', fullName: 'Jane Doe' },
  { publicId: 'user-2', fullName: 'John Roe' },
]

function renderModal(overrides: Partial<Parameters<typeof WorkingWeekOverrideModal>[0]> = {}) {
  return render(
    <WorkingWeekOverrideModal
      groupName="Egypt"
      people={people}
      groupWeekendDays={['FRIDAY', 'SATURDAY']}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      onWarning={vi.fn()}
      {...overrides}
    />,
  )
}

/** Both people, Sunday instead of Friday, a future date. */
async function selectWholeRoster(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('Jane Doe'))
  await user.click(screen.getByText('John Roe'))
  await user.click(screen.getByRole('checkbox', { name: /Sun weekend day/i }))
  await user.click(screen.getByRole('checkbox', { name: /Fri weekend day/i }))
  fireEvent.change(screen.getByLabelText(/^from$/i), { target: { value: '2027-01-01' } })
}

const expectedRequest = {
  subjectIds: ['user-1', 'user-2'],
  weekendDays: expect.arrayContaining(['SATURDAY', 'SUNDAY']),
  effectiveFrom: '2027-01-01',
}

const cleanPreview = {
  weekendDays: ['SATURDAY', 'SUNDAY'] as const,
  effectiveFrom: '2027-01-01',
  subjectCount: 2,
  resolvedCount: 2,
  conflicts: [],
}

describe('WorkingWeekOverrideModal', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts from the group pattern and keeps Confirm disabled until a preview resolves', async () => {
    const user = userEvent.setup()
    const previewSpy = vi.spyOn(apiClient, 'previewWorkingWeekOverride').mockResolvedValue({ ...cleanPreview, weekendDays: ['SATURDAY', 'SUNDAY'] })

    renderModal()

    expect(screen.getByRole('checkbox', { name: /Fri weekend day/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Sat weekend day/i })).toBeChecked()
    expect(screen.getByTestId('override-preview-submit')).toBeDisabled()
    expect(screen.getByTestId('override-confirm-submit')).toBeDisabled()

    await selectWholeRoster(user)
    expect(screen.getByTestId('override-selected-count')).toHaveTextContent('2 people selected')
    expect(screen.getByTestId('override-confirm-submit')).toBeDisabled()

    await user.click(screen.getByTestId('override-preview-submit'))

    await waitFor(() => {
      expect(previewSpy).toHaveBeenCalledWith(expectedRequest)
    })
    expect(screen.getByTestId('override-resolved-count')).toHaveTextContent('2 people would get this working week')
    expect(screen.getByTestId('override-confirm-submit')).toBeEnabled()

    // Any change after the preview invalidates it: the numbers on screen no longer describe the batch.
    await user.click(screen.getByText('John Roe'))
    expect(screen.getByTestId('override-confirm-submit')).toBeDisabled()
  })

  it('commits the previewed batch once with an idempotency key and reports how many it reached', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    vi.spyOn(apiClient, 'previewWorkingWeekOverride').mockResolvedValue({ ...cleanPreview, weekendDays: ['SATURDAY', 'SUNDAY'] })
    const commitSpy = vi.spyOn(apiClient, 'commitWorkingWeekOverride').mockResolvedValue({
      commitPublicId: 'commit-1',
      weekendDays: ['SATURDAY', 'SUNDAY'],
      effectiveFrom: '2027-01-01',
      subjectCount: 2,
      resolvedCount: 2,
    })

    renderModal({ onSuccess, onClose })

    await selectWholeRoster(user)
    await user.click(screen.getByTestId('override-preview-submit'))
    await waitFor(() => expect(screen.getByTestId('override-confirm-submit')).toBeEnabled())

    await user.click(screen.getByTestId('override-confirm-submit'))

    await waitFor(() => {
      expect(commitSpy).toHaveBeenCalledTimes(1)
    })
    const [key, payload] = commitSpy.mock.calls[0]
    expect(key).toMatch(/[0-9a-f-]{36}/)
    expect(payload).toEqual(expectedRequest)
    expect(onSuccess).toHaveBeenCalledWith('Personal working weeks set for 2 people')
    expect(onClose).toHaveBeenCalled()
  })

  it('names the people the server could not resolve and blocks Confirm when nobody resolves', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'previewWorkingWeekOverride').mockResolvedValue({
      ...cleanPreview,
      weekendDays: ['SATURDAY', 'SUNDAY'],
      resolvedCount: 0,
      conflicts: [
        { subjectId: 'user-1', reason: 'NO_WORKFORCE_GROUP' },
        { subjectId: 'user-2', reason: 'SUBJECT_NOT_FOUND' },
      ],
    })

    renderModal()

    await selectWholeRoster(user)
    await user.click(screen.getByTestId('override-preview-submit'))

    const conflicts = await screen.findByTestId('override-conflicts')
    expect(within(conflicts).getByText(/Jane Doe.*has no workforce group/)).toBeInTheDocument()
    expect(within(conflicts).getByText(/John Roe.*could not be found/)).toBeInTheDocument()
    expect(screen.getByTestId('override-confirm-submit')).toBeDisabled()
  })

  it('withdraws the affordance when the plan does not include personal working weeks', async () => {
    const user = userEvent.setup()
    const onWarning = vi.fn()
    const onCapabilityUnavailable = vi.fn()
    vi.spyOn(apiClient, 'previewWorkingWeekOverride').mockRejectedValue(
      new apiClient.ApiError(403, { status: 403, code: 'capability-unavailable', title: 'Capability unavailable' }),
    )

    renderModal({ onWarning, onCapabilityUnavailable })

    await selectWholeRoster(user)
    await user.click(screen.getByTestId('override-preview-submit'))

    expect(await screen.findByTestId('override-capability-unavailable')).toBeInTheDocument()
    expect(onCapabilityUnavailable).toHaveBeenCalled()
    expect(onWarning).toHaveBeenCalledWith(
      'Personal working weeks are not included in this plan, so this cannot be saved.',
    )
    expect(screen.getByTestId('override-preview-submit')).toBeDisabled()
    expect(screen.getByTestId('override-confirm-submit')).toBeDisabled()
  })

  it('says so when the group has nobody to give a pattern to', () => {
    renderModal({ people: [] })

    expect(screen.getByTestId('override-no-people')).toHaveTextContent('No active people in this group yet.')
    expect(screen.queryByTestId('override-subjects-list')).not.toBeInTheDocument()
  })
})
