import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/ui/Modal'
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
  const { t } = useTranslation(['approvals', 'common'])
  const titleId = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const confirmEnabled = reason.trim().length > 0 && !isSubmitting

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
          {t('approvals:declineModal.title', { name: employeeName })}
        </h2>
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
