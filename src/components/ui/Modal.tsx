import { useEffect, useRef, type ReactNode } from 'react'
import './modal.css'

type ModalProps = {
  /** id of the element that titles the dialog (aria-labelledby). */
  labelledBy: string
  onClose: () => void
  children: ReactNode
  /** Extra class(es) on the <dialog> for per-modal overrides, e.g. 'modal-wide'. */
  className?: string
  testId?: string
  /** Set false for flows that must not dismiss on backdrop click (e.g. destructive confirms). */
  closeOnBackdrop?: boolean
}

/**
 * Shared modal built on the native <dialog> element. Use this for EVERY modal in
 * the app: the browser traps focus, Escape fires `cancel`, and focus returns to
 * the opener on unmount. Mounting the component opens the dialog — render it
 * conditionally, and treat onClose as a request to unmount.
 */
export function Modal({
  labelledBy,
  onClose,
  children,
  className,
  testId,
  closeOnBackdrop = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return undefined
    }
    const opener = document.activeElement
    if (!dialog.open) {
      dialog.showModal()
    }
    return () => {
      if (dialog.open) {
        dialog.close()
      }
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus()
      }
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className={['modal', className].filter(Boolean).join(' ')}
      aria-labelledby={labelledBy}
      data-testid={testId}
      onCancel={(event) => {
        // Keep unmounting under React's control instead of letting the dialog self-close.
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (!closeOnBackdrop || event.target !== event.currentTarget) {
          return
        }
        // Backdrop clicks target the dialog with coordinates outside its box.
        const rect = event.currentTarget.getBoundingClientRect()
        const insideDialog =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        if (!insideDialog) {
          onClose()
        }
      }}
    >
      {children}
    </dialog>
  )
}
