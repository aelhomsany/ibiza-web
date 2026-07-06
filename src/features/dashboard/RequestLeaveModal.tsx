import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ApiError, getLeaveTypes } from '../../api/client'
import { DateField } from '../../components/DateField'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'
import { useAuth } from '../../auth/useAuth'
import { useCreateLeaveRequest } from './useCreateLeaveRequest'
import { useLeaveRequestPreview } from './useLeaveRequestPreview'
import '../settings/team-members.css'
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

function workingDayLabel(count: number): string {
  return count === 1 ? 'working day' : 'working days'
}

export function RequestLeaveModal({ open, onClose, onSuccess }: RequestLeaveModalProps) {
  const { user } = useAuth()
  const orgId = user?.organizationId
  const createMutation = useCreateLeaveRequest()

  const [leaveTypeId, setLeaveTypeId] = useState<number | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [note, setNote] = useState('')
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null)

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
      ? previewQuery.error.problem.detail ?? 'Unable to preview working days'
      : previewQuery.isError
        ? 'Unable to preview working days'
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
            setSubmitErrorMessage(error.problem.detail ?? 'Unable to submit leave request')
            return
          }
          setSubmitErrorMessage('Unable to submit leave request')
        },
      },
    )
  }

  return (
    <Modal
      labelledBy="request-leave-modal-title"
      onClose={onClose}
      className="request-leave-modal"
      testId="request-leave-modal"
    >
      <div className="modal-header">
          <span className="modal-title" id="request-leave-modal-title">
            Request Leave
          </span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="leave-type">Leave Type</label>
            <select
              id="leave-type"
              value={leaveTypeId}
              onChange={(event) =>
                setLeaveTypeId(event.target.value === '' ? '' : Number(event.target.value))
              }
              required
            >
              <option value="">— Select leave type —</option>
              {(leaveTypesQuery.data ?? []).map((leaveType) => (
                <option key={leaveType.id} value={leaveType.id}>
                  {leaveType.icon ? `${leaveType.icon} ` : ''}
                  {leaveType.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group date-row">
            <div className="form-group">
              <label htmlFor="leave-from-date">From</label>
              <DateField
                id="leave-from-date"
                data-testid="leave-from-date"
                value={dateFrom}
                onChange={setDateFrom}
                aria-label="From date"
              />
            </div>
            <div className="form-group">
              <label htmlFor="leave-to-date">To</label>
              <DateField
                id="leave-to-date"
                data-testid="leave-to-date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={setDateTo}
                aria-label="To date"
              />
            </div>
          </div>

          <div className="days-indicator" data-testid="working-day-preview">
            {clientDateInvalid && (
              <p className="preview-error" role="alert">
                End date must be on or after start date
              </p>
            )}

            {!clientDateInvalid && !previewEnabled && (
              <p className="preview-loading">Select dates to preview working days</p>
            )}

            {!clientDateInvalid && previewEnabled && previewQuery.isPending && (
              <p className="preview-loading">Calculating working days…</p>
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
                    <strong>{preview.workingDays}</strong> {workingDayLabel(preview.workingDays)} will
                    be charged
                  </p>
                )}
                <p className="group-context">
                  Based on {preview.workforceGroupName} Workforce Group weekends &amp; holidays
                </p>
                {excludedTotal > 0 && (
                  <p className="preview-excluded">
                    {excludedTotal} weekend/holiday day{excludedTotal === 1 ? '' : 's'} excluded
                    from balance
                  </p>
                )}
              </>
            )}
          </div>

          {previewEnabled && preview && preview.workingDays === 0 && !previewQuery.isPending && (
            <p className="zero-day-alert" role="alert">
              No working days in selected range for your {preview.workforceGroupName} Workforce
              Group
            </p>
          )}

          {submitErrorMessage && (
            <p className="preview-error" role="alert">
              {submitErrorMessage}
            </p>
          )}

          <div className="form-group">
            <label htmlFor="leave-note">Note (optional)</label>
            <textarea
              id="leave-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              data-testid="submit-request-btn"
              disabled={submitDisabled}
            >
              {createMutation.isPending ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
    </Modal>
  )
}
