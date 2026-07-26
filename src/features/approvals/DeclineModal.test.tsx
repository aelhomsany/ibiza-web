import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { vi } from 'vitest'
import { DeclineModal } from './DeclineModal'

function ControlledDeclineModal(props: {
  onConfirm: (reason: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  return (
    <DeclineModal
      requestId={101}
      employeeName="Sarah Chen"
      dateRange="Jun 15–17, 2026"
      reason={reason}
      onReasonChange={setReason}
      onConfirm={props.onConfirm}
      onCancel={props.onCancel}
    />
  )
}

describe('DeclineModal', () => {
  it('[P1] keeps confirm disabled until a non-blank reason is entered', async () => {
    const user = userEvent.setup()
    render(<ControlledDeclineModal onConfirm={vi.fn()} onCancel={vi.fn()} />)

    const confirm = screen.getByTestId('decline-confirm-btn')
    expect(confirm).toBeDisabled()

    await user.type(screen.getByTestId('decline-reason-input'), '   ')
    expect(confirm).toBeDisabled()
  })

  it('[P1] enables confirm once a real reason is typed and fires onConfirm with it', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ControlledDeclineModal onConfirm={onConfirm} onCancel={vi.fn()} />)

    await user.type(screen.getByTestId('decline-reason-input'), 'Coverage gap that week')

    const confirm = screen.getByTestId('decline-confirm-btn')
    expect(confirm).toBeEnabled()

    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('Coverage gap that week')
  })

  it('[P1] cancel closes the modal without firing onConfirm', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ControlledDeclineModal onConfirm={onConfirm} onCancel={onCancel} />)

    await user.click(screen.getByTestId('decline-cancel-btn'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
