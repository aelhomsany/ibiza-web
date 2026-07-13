import { fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { vi } from 'vitest'
import { mockBackdropGeometry } from '../../test/backdropTestUtils'
import { Modal } from './Modal'

const modalCss = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'modal.css'), 'utf8')

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
  afterEach(() => {
    vi.restoreAllMocks()
  })

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

  it('does not close on backdrop clicks when closeOnBackdrop is false', () => {
    const { onClose } = renderModal({ closeOnBackdrop: false })
    const dialog = screen.getByTestId('test-modal')
    mockBackdropGeometry(dialog)

    fireEvent.click(dialog, { clientX: 20, clientY: 20 })

    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on backdrop clicks outside the dialog bounds by default', () => {
    const { onClose } = renderModal()
    const dialog = screen.getByTestId('test-modal')
    mockBackdropGeometry(dialog)

    fireEvent.click(dialog, { clientX: 20, clientY: 20 })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps modal close buttons at a 32px-plus touch target on the 4px grid', () => {
    expect(modalCss).toMatch(/\.modal-close\s*{[^}]*padding:\s*8px;/s)
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
