import { render, screen, waitFor } from '@testing-library/react'
import { isolate } from '../../i18n/bidi'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { WorkforceGroupModal } from './WorkforceGroupModal'

function renderModal(overrides: Partial<Parameters<typeof WorkforceGroupModal>[0]> = {}) {
  return render(
    <WorkforceGroupModal
      defaultTimezone="Africa/Cairo"
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      onWarning={vi.fn()}
      {...overrides}
    />,
  )
}

describe('WorkforceGroupModal', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('blocks submit when group name is blank', async () => {
    const user = userEvent.setup()
    const createSpy = vi.spyOn(apiClient, 'createWorkforceGroup')

    renderModal()

    const submit = screen.getByTestId('create-group-submit')
    expect(submit).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /Sat/i }))
    expect(submit).toBeDisabled()
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('shows warning when deselecting the last weekend day', async () => {
    const user = userEvent.setup()
    const onWarning = vi.fn()

    renderModal({ onWarning })

    await user.click(screen.getByRole('checkbox', { name: /Sat/i }))
    await user.click(screen.getByRole('checkbox', { name: /Fri/i }))
    expect(onWarning).toHaveBeenCalledWith('Select at least one weekend day')
  })

  /**
   * Plan UNO: the group is created in ONE request carrying name, zone and weekend pattern. The old
   * two-step create-then-PUT left a half-configured group behind when the second call failed.
   */
  it('creates the group with its name, time zone and weekend days in one request', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    const createSpy = vi.spyOn(apiClient, 'createWorkforceGroup').mockResolvedValue({
      id: 3,
      name: 'UK',
      timezone: 'UTC',
      weekendDays: ['SATURDAY', 'SUNDAY'],
      currentEffectiveFrom: '2000-01-01',
      scheduledChanges: [],
      overrideCount: 0,
    })

    renderModal({ onSuccess })

    // The zone the host hands over is pre-selected; the admin can still pick another.
    expect(screen.getByLabelText('Time zone')).toHaveValue('Africa/Cairo')
    await user.type(screen.getByLabelText(/group name/i), 'UK')
    await user.selectOptions(screen.getByLabelText('Time zone'), 'UTC')
    await user.click(screen.getByRole('checkbox', { name: /Fri/i }))
    await user.click(screen.getByRole('checkbox', { name: /Sun/i }))
    await user.click(screen.getByTestId('create-group-submit'))

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(1)
    })
    const [payload] = createSpy.mock.calls[0]
    expect(payload.name).toBe('UK')
    expect(payload.timezone).toBe('UTC')
    expect(payload.weekendDays).toHaveLength(2)
    expect(payload.weekendDays).toEqual(expect.arrayContaining(['SATURDAY', 'SUNDAY']))
    expect(onSuccess).toHaveBeenCalledWith(`Workforce Group "${isolate('UK')}" created`, 3)
  })

  it('reports a failed create without claiming success', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    const onWarning = vi.fn()
    vi.spyOn(apiClient, 'createWorkforceGroup').mockRejectedValue(new Error('boom'))

    renderModal({ onSuccess, onWarning })

    await user.type(screen.getByLabelText(/group name/i), 'UK')
    await user.click(screen.getByTestId('create-group-submit'))

    await waitFor(() => {
      expect(onWarning).toHaveBeenCalledWith('Failed to create workforce group')
    })
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
