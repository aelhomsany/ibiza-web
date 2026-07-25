import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, getLeaveTypes } from '../../api/client'
import { fieldErrorsFromApiError, LEAVE_REQUEST_FIELD_IDS } from '../../api/fieldViolations'
import { DateField } from '../../components/DateField'
import { FieldErrorMessage } from '../../components/form/FieldErrorMessage'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'
import { useAuth } from '../../auth/useAuth'
import { useCreateLeaveRequest } from './useCreateLeaveRequest'
import { useLeaveRequestPreview } from './useLeaveRequestPreview'
import { translateFieldViolation } from '../../i18n/fieldViolationMessage'
import './request-leave.css'

type RequestLeaveModalProps = {
  open: boolean
  onClose: () => void
  /** Story 3.4 — success toast callback from parent */
  onSuccess?: () => void
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

export function RequestLeaveModal({ open, onClose, onSuccess }: RequestLeaveModalProps) {
  const { t } = useTranslation(['dashboard', 'common'])
  const { user } = useAuth()
  const orgId = user?.organizationId
  const createMutation = useCreateLeaveRequest()

  const [leaveTypeId, setLeaveTypeId] = useState<number | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [note, setNote] = useState('')
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const debouncedFrom = useDebouncedValue(dateFrom, 300)
  const debouncedTo = useDebouncedValue(dateTo, 300)

  const leaveTypesQuery = useQuery({
    queryKey: ['leave-types', orgId],
    queryFn: getLeaveTypes,
    enabled: open && orgId != null,
  })

  const previewQuery = useLeaveRequestPreview(debouncedFrom, debouncedTo)

  const clientDateInvalid =
    dateFrom !== '' && dateTo !== '' && dateTo < dateFrom
  const previewEnabled =
    debouncedFrom !== '' && debouncedTo !== '' && debouncedTo >= debouncedFrom

  const preview = previewQuery.data
  const excludedTotal =
    preview != null ? preview.excludedWeekends + preview.excludedHolidays : 0

  const previewErrorMessage =
    previewQuery.error instanceof ApiError
      ? previewQuery.error.problem.detail ?? t('dashboard:request.errors.preview')
      : previewQuery.isError
        ? t('dashboard:request.errors.preview')
        : null

  const submitDisabled =
    leaveTypeId === '' ||
    !previewEnabled ||
    clientDateInvalid ||
    previewQuery.isPending ||
    previewQuery.isFetching ||
    previewQuery.isError ||
    preview == null ||
    preview.workingDays === 0 ||
    createMutation.isPending

  useEffect(() => {
    if (!open) {
      setLeaveTypeId('')
      setDateFrom('')
      setDateTo('')
      setNote('')
      setSubmitErrorMessage(null)
      setFieldErrors({})
      createMutation.reset()
    }
  }, [open])

  if (!open) {
    return null
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitDisabled) {
      return
    }

    const selectedLeaveTypeId = leaveTypeId as number
    const trimmedNote = note.trim()

    setSubmitErrorMessage(null)
    setFieldErrors({})
    createMutation.mutate(
      {
        leaveTypeId: selectedLeaveTypeId,
        dateFrom,
        dateTo,
        note: trimmedNote === '' ? undefined : trimmedNote,
      },
      {
        onSuccess: () => {
          onSuccess?.()
          onClose()
        },
        onError: (error) => {
          if (error instanceof ApiError) {
            const nextFieldErrors = fieldErrorsFromApiError(error.fieldViolations)
            if (nextFieldErrors) {
              setFieldErrors(
                Object.fromEntries(
                  Object.entries(nextFieldErrors).map(([field, message]) => [
                    field,
                    translateFieldViolation(field, message),
                  ]),
                ),
              )
              return
            }
            setSubmitErrorMessage(error.problem.detail ?? t('dashboard:request.errors.submit'))
            return
          }
          setSubmitErrorMessage(t('dashboard:request.errors.submit'))
        },
      },
    )
  }

  function clearFieldError(field: string) {
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function fieldErrorProps(field: keyof typeof LEAVE_REQUEST_FIELD_IDS) {
    const fieldId = LEAVE_REQUEST_FIELD_IDS[field]
    const message = fieldErrors[field]
    if (!message) {
      return { message: undefined, fieldId, invalid: false, describedBy: undefined }
    }
    return {
      message,
      fieldId,
      invalid: true,
      describedBy: `field-error-${fieldId}`,
    }
  }

  const leaveTypeError = fieldErrorProps('leaveTypeId')
  const dateFromError = fieldErrorProps('dateFrom')
  const dateToError = fieldErrorProps('dateTo')
  const noteError = fieldErrorProps('note')

  return (
    <Modal
      labelledBy="request-leave-modal-title"
      onClose={onClose}
      className="request-leave-modal"
      testId="request-leave-modal"
      closeOnBackdrop={false}
    >
      <div className="modal-header">
          <span className="modal-title" id="request-leave-modal-title">
            {t('dashboard:request.title')}
          </span>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('common:actions.close')}>
            <CloseIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="leave-type">{t('dashboard:request.fields.leaveType')}</label>
            <select
              id="leave-type"
              value={leaveTypeId}
              onChange={(event) => {
                setLeaveTypeId(event.target.value === '' ? '' : Number(event.target.value))
                clearFieldError('leaveTypeId')
              }}
              required
              aria-invalid={leaveTypeError.invalid || undefined}
              aria-describedby={leaveTypeError.describedBy}
            >
              <option value="">{t('dashboard:request.fields.selectLeaveType')}</option>
              {(leaveTypesQuery.data ?? []).map((leaveType) => (
                <option key={leaveType.id} value={leaveType.id}>
                  {leaveType.icon ? `${leaveType.icon} ` : ''}
                  {leaveType.name}
                </option>
              ))}
            </select>
            {leaveTypeError.message && (
              <FieldErrorMessage fieldId={leaveTypeError.fieldId} message={leaveTypeError.message} />
            )}
          </div>

          <div className="form-group date-row">
            <div className="form-group">
              <label htmlFor="leave-from-date">{t('dashboard:request.fields.from')}</label>
              <DateField
                id="leave-from-date"
                data-testid="leave-from-date"
                value={dateFrom}
                onChange={(value) => {
                  setDateFrom(value)
                  clearFieldError('dateFrom')
                }}
                aria-label={t('dashboard:request.fields.fromDate')}
                aria-invalid={dateFromError.invalid || undefined}
                aria-describedby={dateFromError.describedBy}
              />
              {dateFromError.message && (
                <FieldErrorMessage fieldId={dateFromError.fieldId} message={dateFromError.message} />
              )}
            </div>
            <div className="form-group">
              <label htmlFor="leave-to-date">{t('dashboard:request.fields.to')}</label>
              <DateField
                id="leave-to-date"
                data-testid="leave-to-date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(value) => {
                  setDateTo(value)
                  clearFieldError('dateTo')
                }}
                aria-label={t('dashboard:request.fields.toDate')}
                aria-invalid={dateToError.invalid || undefined}
                aria-describedby={dateToError.describedBy}
              />
              {dateToError.message && (
                <FieldErrorMessage fieldId={dateToError.fieldId} message={dateToError.message} />
              )}
            </div>
          </div>

          <div className="days-indicator" data-testid="working-day-preview">
            {clientDateInvalid && (
              <p className="preview-error" role="alert">
                {t('dashboard:request.preview.dateRange')}
              </p>
            )}

            {!clientDateInvalid && !previewEnabled && (
              <p className="preview-loading">{t('dashboard:request.preview.selectDates')}</p>
            )}

            {!clientDateInvalid && previewEnabled && previewQuery.isPending && (
              <p className="preview-loading">{t('dashboard:request.preview.calculating')}</p>
            )}

            {!clientDateInvalid && previewEnabled && previewErrorMessage && (
              <p className="preview-error" role="alert">
                {previewErrorMessage}
              </p>
            )}

            {!clientDateInvalid && previewEnabled && preview && !previewQuery.isPending && !previewQuery.isError && (
              <>
                {preview.workingDays > 0 && (
                  <p className="preview-primary">
                    {t('dashboard:request.preview.charged', { count: preview.workingDays })}
                  </p>
                )}
                <p className="group-context">
                  {t('dashboard:request.preview.context', { name: preview.workforceGroupName })}
                </p>
                {excludedTotal > 0 && (
                  <p className="preview-excluded">
                    {t('dashboard:request.preview.excluded', { count: excludedTotal })}
                  </p>
                )}
              </>
            )}
          </div>

          {previewEnabled && preview && preview.workingDays === 0 && !previewQuery.isPending && (
            <p className="zero-day-alert" role="alert">
              {t('dashboard:request.preview.zero', { name: preview.workforceGroupName })}
            </p>
          )}

          {submitErrorMessage && (
            <p className="preview-error" role="alert">
              {submitErrorMessage}
            </p>
          )}

          <div className="form-group">
            <label htmlFor="leave-note">{t('dashboard:request.fields.note')}</label>
            <textarea
              id="leave-note"
              value={note}
              onChange={(event) => {
                setNote(event.target.value)
                clearFieldError('note')
              }}
              rows={3}
              aria-invalid={noteError.invalid || undefined}
              aria-describedby={noteError.describedBy}
            />
            {noteError.message && (
              <FieldErrorMessage fieldId={noteError.fieldId} message={noteError.message} />
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              {t('common:actions.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              data-testid="submit-request-btn"
              disabled={submitDisabled}
              data-busy={createMutation.isPending ? 'true' : undefined}
            >
              {createMutation.isPending
                ? t('dashboard:request.actions.submitting')
                : t('dashboard:request.actions.submit')}
            </button>
          </div>
        </form>
    </Modal>
  )
}
