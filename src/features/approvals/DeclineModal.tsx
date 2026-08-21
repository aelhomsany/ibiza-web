import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { isolate } from '../../i18n/bidi'
import { Modal } from '../../components/ui/Modal'
import './approvals.css'

type DeclineModalProps = {
  requestId: number
  employeeName: string
  dateRange: string
  reason: string
  onReasonChange: (reason: string) => void
  onConfirm: (reason: string) => void
  onCancel: () => void
  isSubmitting?: boolean
  submitError?: string | null
  isStale?: boolean
}

export function DeclineModal({
  requestId,
  employeeName,
  dateRange,
  reason,
  onReasonChange,
  onConfirm,
  onCancel,
  isSubmitting = false,
  submitError = null,
  isStale = false,
}: DeclineModalProps) {
  const { t } = useTranslation(['approvals', 'common'])
  const titleId = useId()
  const contextId = `${titleId}-context`
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Once the request is known-stale (decided elsewhere → 409), the only valid
  // action is Cancel; keep Confirm disabled so the dead request cannot be re-submitted.
  const confirmEnabled = reason.trim().length > 0 && !isSubmitting && !isStale

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  return (
    <Modal
      labelledBy={titleId}
      onClose={onCancel}
      className="decline-modal-panel modal-backdrop-accent"
      testId="decline-modal"
      closeOnBackdrop={false}
    >
        <h2 id={titleId} className="decline-modal-title">
          {t('approvals:declineModal.title', { name: isolate(employeeName) })}
        </h2>
        <p id={contextId} className="decline-modal-context">
          <bdi>{dateRange}</bdi>
        </p>
        <p className="decline-modal-sub">{t('approvals:declineModal.subtitle')}</p>
        <label className="decline-modal-label" htmlFor={`decline-reason-${requestId}`}>
          {t('approvals:declineModal.label')}
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
          aria-describedby={
            submitError ? `${contextId} ${titleId}-error` : contextId
          }
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
            {t('common:actions.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger-outline"
            data-testid="decline-confirm-btn"
            disabled={!confirmEnabled}
            data-busy={isSubmitting ? 'true' : undefined}
            onClick={() => onConfirm(reason.trim())}
          >
            {t('approvals:actions.confirmDecline')}
          </button>
        </div>
    </Modal>
  )
}
