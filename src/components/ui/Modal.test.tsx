import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { Modal } from './Modal'

function renderModal(overrides: Partial<Parameters<typeof Modal>[0]> = {}) {
  const onClose = vi.fn()
  render(
    <Modal labelledBy="modal-title" onClose={onClose} testId="test-modal" {...overrides}>
      <h2 id="modal-title">Example dialog</h2>
      <button type="button">Do it</button>
    </Modal>,
  )
  return { onClose }
}

describe('Modal', () => {
  it('renders an open native dialog labelled by its title', () => {
    renderModal()
    const dialog = screen.getByTestId('test-modal')
    expect(dialog.tagName).toBe('DIALOG')
    expect(dialog).toHaveAttribute('open')
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title')
    expect(screen.getByRole('heading', { name: 'Example dialog' })).toBeInTheDocument()
  })

  it('requests close on Escape (dialog cancel event)', () => {
    const { onClose } = renderModal()
    fireEvent(screen.getByTestId('test-modal'), new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close on clicks inside the dialog content', () => {
    const { onClose } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Do it' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('returns focus to the opener when unmounted', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()

    const onClose = vi.fn()
    const { unmount } = render(
      <Modal labelledBy="modal-title" onClose={onClose}>
        <h2 id="modal-title">Example dialog</h2>
      </Modal>,
    )
    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})
