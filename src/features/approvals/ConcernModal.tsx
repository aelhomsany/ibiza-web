import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'

type Props = {
  employeeName: string
  note: string
  isSubmitting: boolean
  error?: string | null
  onNoteChange: (value: string) => void
  onClose: () => void
  onConfirm: (note: string) => void
}

export function ConcernModal({
  employeeName,
  note,
  isSubmitting,
  error,
  onNoteChange,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useTranslation(['approvals', 'common'])
  const trimmed = note.trim()
  const safeClose = () => {
    if (!isSubmitting) onClose()
  }
  return (
    <Modal labelledBy="concern-modal-title" onClose={safeClose} closeOnBackdrop={false}>
      <div className="modal-header">
        <h2 className="modal-title" id="concern-modal-title">
          {t('approvals:concern.title')}
        </h2>
        <button type="button" className="modal-close" onClick={safeClose} disabled={isSubmitting} aria-label={t('common:actions.close')}>
          <CloseIcon size={18} />
        </button>
      </div>
      <p>{t('approvals:concern.help', { name: employeeName })}</p>
      <div className="form-group">
        <label htmlFor="approval-concern-note">{t('approvals:concern.note')}</label>
        <textarea
          id="approval-concern-note"
          value={note}
          maxLength={500}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <div className="modal-actions">
        <button type="button" className="btn btn-outline" onClick={safeClose} disabled={isSubmitting}>{t('common:actions.cancel')}</button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!trimmed || isSubmitting}
          onClick={() => onConfirm(trimmed)}
        >
          {t('approvals:concern.confirm')}
        </button>
      </div>
    </Modal>
  )
}
