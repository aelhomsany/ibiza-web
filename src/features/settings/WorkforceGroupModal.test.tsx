import { render, screen, waitFor } from '@testing-library/react'
import { isolate } from '../../i18n/bidi'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { WorkforceGroupModal } from './WorkforceGroupModal'

describe('WorkforceGroupModal', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('blocks submit when group name is blank', async () => {
    const user = userEvent.setup()
    const createSpy = vi.spyOn(apiClient, 'createWorkforceGroup')

    render(
      <WorkforceGroupModal
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onWarning={vi.fn()}
      />,
    )

    const submit = screen.getByTestId('create-group-submit')
    expect(submit).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /Sat/i }))
    expect(submit).toBeDisabled()
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('shows warning when deselecting the last weekend day', async () => {
    const user = userEvent.setup()
    const onWarning = vi.fn()

    render(
      <WorkforceGroupModal
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onWarning={onWarning}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: /Sat/i }))
    await user.click(screen.getByRole('checkbox', { name: /Fri/i }))
    expect(onWarning).toHaveBeenCalledWith('Select at least one weekend day')
  })

  it('calls createWorkforceGroup and putWorkforceGroupWeekendDays on valid submit', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    vi.spyOn(apiClient, 'createWorkforceGroup').mockResolvedValue({
      id: 3,
      name: 'UK',
      weekendDays: [],
    })
    const putSpy = vi.spyOn(apiClient, 'putWorkforceGroupWeekendDays').mockResolvedValue({
      id: 3,
      name: 'UK',
      weekendDays: ['SATURDAY', 'SUNDAY'],
    })

    render(
      <WorkforceGroupModal
        onClose={vi.fn()}
        onSuccess={onSuccess}
        onWarning={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText(/group name/i), 'UK')
    await user.click(screen.getByRole('checkbox', { name: /Sun/i }))
    await user.click(screen.getByTestId('create-group-submit'))

    await waitFor(() => {
      expect(apiClient.createWorkforceGroup).toHaveBeenCalledWith({ name: 'UK' })
      expect(putSpy).toHaveBeenCalledWith(3, expect.arrayContaining(['SATURDAY', 'SUNDAY']))
      expect(onSuccess).toHaveBeenCalledWith(`Workforce Group "${isolate('UK')}" created`, 3)
    })
  })
})
