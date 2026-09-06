import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, commitWorkingWeekOverride, previewWorkingWeekOverride } from '../../api/client'
import type { DayOfWeek, WorkingWeekOverridePreviewResponse } from '../../api/generated/types'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'
import { DateField } from '../../components/DateField'
import { isolate } from '../../i18n/bidi'
import { WeekendDayChips } from './WeekendDayChips'
import './team-members.css'
import './weekend-day-chips.css'
// .settings-card / .form-group / .checkbox-list are global (card.css, form-fields.css); the modal
// chrome is the shared Modal's own stylesheet, imported explicitly so this modal does not depend
// on some other feature having loaded it first.
import '../../components/ui/modal.css'

export type OverrideCandidate = {
  publicId: string
  fullName: string
}

type WorkingWeekOverrideModalProps = {
  groupName: string
  /** Active people in the group; the server rejects anyone outside it or deactivated. */
  people: OverrideCandidate[]
  /** The group's own pattern, offered as the starting point so the admin edits a difference. */
  groupWeekendDays: DayOfWeek[]
  onClose: () => void
  onSuccess: (message: string) => void
  onWarning?: (message: string) => void
  /** DISTRIBUTED_OPERATIONS is not in every plan; the host hides the affordance once told. */
  onCapabilityUnavailable?: () => void
}

/** Server cap -- kept in sync with WorkingWeekOverrideRequest's @Size(max = 500). */
const MAX_SUBJECTS = 500

/**
 * Gives a set of people their own working week from a date (Plan UNO). SPA-only guard: Confirm
 * stays disabled until a Preview has resolved for the CURRENT selection -- any change invalidates
 * it, and the idempotency key minted at preview time is what makes a double-click a replay rather
 * than a second commit. The server does not require the preview; the sequencing is a UX guard.
 */
export function WorkingWeekOverrideModal({
  groupName,
  people,
  groupWeekendDays,
  onClose,
  onSuccess,
  onWarning,
  onCapabilityUnavailable,
}: WorkingWeekOverrideModalProps) {
  const { t } = useTranslation(['settings', 'common'])
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([])
  const [weekendDays, setWeekendDays] = useState<DayOfWeek[]>(groupWeekendDays)
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [preview, setPreview] = useState<WorkingWeekOverridePreviewResponse | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null)
  const [capabilityUnavailable, setCapabilityUnavailable] = useState(false)

  const overCap = selectedSubjectIds.length > MAX_SUBJECTS
  const canPreview =
    selectedSubjectIds.length > 0 &&
    !overCap &&
    weekendDays.length > 0 &&
    effectiveFrom.length > 0

  function invalidatePreview() {
    setPreview(null)
    setIdempotencyKey(null)
  }

  function toggleSubject(publicId: string) {
    setSelectedSubjectIds((current) =>
      current.includes(publicId) ? current.filter((id) => id !== publicId) : [...current, publicId],
    )
    invalidatePreview()
  }

  function changeWeekendDays(next: DayOfWeek[]) {
    if (next.length === 0) {
      onWarning?.(t('settings:groups.selectWeekend'))
      return
    }
    setWeekendDays(next)
    invalidatePreview()
  }

  function personName(publicId: string): string {
    return people.find((person) => person.publicId === publicId)?.fullName ?? publicId
  }

  function currentRequest() {
    return { subjectIds: selectedSubjectIds, weekendDays, effectiveFrom }
  }

  function reportFailure(cause: unknown, fallbackKey: string) {
    if (cause instanceof ApiError && cause.problem.code === 'capability-unavailable') {
      setCapabilityUnavailable(true)
      onCapabilityUnavailable?.()
      onWarning?.(t('settings:groups.overrides.modal.errors.capabilityUnavailable'))
      return
    }
    if (cause instanceof ApiError && cause.problem.code === 'working-week-override-conflict') {
      onWarning?.(t('settings:groups.overrides.modal.errors.conflict'))
      return
    }
    if (cause instanceof ApiError && cause.problem.code === 'working-week-override-idempotency-conflict') {
      // The key already resolved against different evidence -- reusing it reproduces the conflict
      // forever, so drop it and send the admin back to preview.
      invalidatePreview()
      onWarning?.(t('settings:groups.overrides.modal.errors.idempotencyConflict'))
      return
    }
    if (cause instanceof ApiError && cause.fieldViolations?.subjectIds?.length) {
      onWarning?.(cause.fieldViolations.subjectIds.join(' '))
      return
    }
    if (cause instanceof ApiError && cause.fieldViolations?.effectiveFrom?.length) {
      onWarning?.(cause.fieldViolations.effectiveFrom.join(' '))
      return
    }
    onWarning?.(t(fallbackKey))
  }

  async function handlePreview() {
    if (!canPreview) {
      onWarning?.(
        t(
          overCap
            ? 'settings:groups.overrides.modal.errors.overCap'
            : 'settings:groups.overrides.modal.errors.incomplete',
        ),
      )
      return
    }
    setPreviewing(true)
    try {
      const result = await previewWorkingWeekOverride(currentRequest())
      setPreview(result)
      setIdempotencyKey(crypto.randomUUID())
    } catch (cause) {
      reportFailure(cause, 'settings:groups.overrides.modal.errors.preview')
    } finally {
      setPreviewing(false)
    }
  }

  async function handleConfirm() {
    if (!preview || !idempotencyKey) {
      return
    }
    setCommitting(true)
    try {
      const result = await commitWorkingWeekOverride(idempotencyKey, currentRequest())
      onSuccess(t('settings:groups.overrides.modal.created', { count: result.resolvedCount }))
      onClose()
    } catch (cause) {
      reportFailure(cause, 'settings:groups.overrides.modal.errors.commit')
    } finally {
      setCommitting(false)
    }
  }

  const busy = previewing || committing

  return (
    <Modal
      labelledBy="working-week-override-modal-title"
      onClose={onClose}
      testId="working-week-override-modal"
      className="modal-wide"
    >
      <div className="modal-header">
        <span className="modal-title" id="working-week-override-modal-title">
          {t('settings:groups.overrides.modal.title')}
        </span>
        <button type="button" className="modal-close" onClick={onClose} aria-label={t('common:actions.close')}>
          <CloseIcon size={18} />
        </button>
      </div>

      <div className="form-group">
        <label id="override-subjects-label">
          {t('settings:groups.overrides.modal.people', { name: isolate(groupName) })}
        </label>
        {people.length === 0 ? (
          <p className="form-hint" data-testid="override-no-people">
            {t('settings:groups.overrides.modal.noPeople')}
          </p>
        ) : (
          <ul
            aria-labelledby="override-subjects-label"
            data-testid="override-subjects-list"
            className="checkbox-list"
          >
            {people.map((person) => (
              <li key={person.publicId}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedSubjectIds.includes(person.publicId)}
                    disabled={busy}
                    onChange={() => toggleSubject(person.publicId)}
                  />
                  <span dir="auto">{person.fullName}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="form-hint" data-testid="override-selected-count">
          {t('settings:groups.overrides.modal.selectedCount', { count: selectedSubjectIds.length })}
        </p>
        {overCap && (
          <p className="form-hint" role="alert" data-testid="override-over-cap">
            {t('settings:groups.overrides.modal.errors.overCap')}
          </p>
        )}
      </div>

      <div className="form-group">
        <label>{t('settings:groups.overrides.modal.weekend')}</label>
        <WeekendDayChips weekendDays={weekendDays} disabled={busy} onChange={changeWeekendDays} />
      </div>

      <div className="form-group">
        <label htmlFor="override-effective-from">{t('settings:groups.overrides.modal.effectiveFrom')}</label>
        <DateField
          id="override-effective-from"
          value={effectiveFrom}
          disabled={busy}
          onChange={(value) => {
            setEffectiveFrom(value)
            invalidatePreview()
          }}
        />
      </div>

      {capabilityUnavailable && (
        <p className="form-hint" role="alert" data-testid="override-capability-unavailable">
          {t('settings:groups.overrides.modal.errors.capabilityUnavailable')}
        </p>
      )}

      <section className="settings-card" aria-live="polite" data-testid="override-preview-panel">
        <h3>{t('settings:groups.overrides.modal.previewTitle')}</h3>
        {!preview ? (
          <p>{t('settings:groups.overrides.modal.previewEmpty')}</p>
        ) : (
          <>
            <p data-testid="override-resolved-count">
              {t('settings:groups.overrides.modal.previewResolved', { count: preview.resolvedCount })}
            </p>
            {preview.conflicts.length > 0 && (
              <ul data-testid="override-conflicts">
                {preview.conflicts.map((conflict) => (
                  <li key={conflict.subjectId}>
                    {t(`settings:groups.overrides.modal.conflictReasons.${conflict.reason}`, {
                      name: isolate(personName(conflict.subjectId)),
                    })}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <div className="modal-actions">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={committing}>
          {t('common:actions.cancel')}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          data-testid="override-preview-submit"
          disabled={!canPreview || busy || capabilityUnavailable}
          onClick={() => void handlePreview()}
        >
          {previewing
            ? t('settings:groups.overrides.modal.previewing')
            : t('settings:groups.overrides.modal.actions.preview')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="override-confirm-submit"
          disabled={!preview || !idempotencyKey || preview.resolvedCount === 0 || busy || capabilityUnavailable}
          onClick={() => void handleConfirm()}
        >
          {t('settings:groups.overrides.modal.actions.confirm')}
        </button>
      </div>
    </Modal>
  )
}
