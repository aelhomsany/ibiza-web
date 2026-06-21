import { useEffect, useId, useRef } from 'react'
import './approvals.css'

type DeclineModalProps = {
  requestId: number
  employeeName: string
  reason: string
  onReasonChange: (reason: string) => void
  onConfirm: (reason: string) => void
  onCancel: () => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function DeclineModal({
  requestId,
  employeeName,
  reason,
  onReasonChange,
  onConfirm,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: DeclineModalProps) {
  const titleId = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const confirmEnabled = reason.trim().length > 0 && !isSubmitting

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  return (
    <div className="decline-modal-backdrop" data-testid="decline-modal">
      <div
        className="decline-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="decline-modal-title">
          Decline request for {employeeName}
        </h2>
        <p className="decline-modal-sub">A reason is required — it will be shown to the employee.</p>
        <label className="decline-modal-label" htmlFor={`decline-reason-${requestId}`}>
          Decline reason
        </label>
        <textarea
          ref={textareaRef}
          id={`decline-reason-${requestId}`}
          className="decline-modal-textarea"
          data-testid="decline-reason-input"
          rows={4}
          maxLength={500}
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          aria-required="true"
          aria-invalid={submitError != null}
          aria-describedby={submitError ? `${titleId}-error` : undefined}
        />
        {submitError ? (
          <p
            id={`${titleId}-error`}
            className="decline-modal-error"
            role="alert"
            data-testid="decline-submit-error"
          >
            {submitError}
          </p>
        ) : null}
        <div className="decline-modal-actions">
          <button
            type="button"
            className="btn btn-sm"
            data-testid="decline-cancel-btn"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger-outline"
            data-testid="decline-confirm-btn"
            disabled={!confirmEnabled}
            onClick={() => onConfirm(reason.trim())}
          >
            Confirm decline
          </button>
        </div>
      </div>
    </div>
  )
}
