import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, previewBulkScheduleAssignment, commitBulkScheduleAssignment } from '../../api/client'
import type { BulkScheduleAssignmentPreviewResponse, LocationContextResponse } from '../../api/generated/types'
import type { components } from '../../api/generated/types'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'
import { DateField } from '../../components/DateField'
import { isolate } from '../../i18n/bidi'
import './team-members.css'
// .settings-card / .form-group / .checkbox-list are global (card.css, form-fields.css); the
// team-members import above is for this modal's own feature rules. The modal chrome is the
// shared Modal's own stylesheet -- imported explicitly for the same reason as
// ScheduleAssignmentModal (code review 2026-08-28 on the sibling modal).
import '../../components/ui/modal.css'

type NamedTarget = components['schemas']['NamedTarget']

export type BulkScheduleVersionOption = {
  scheduleName: string
  versionPublicId: string
  versionNumber: number
}

type BulkScheduleAssignmentModalProps = {
  versionOptions: BulkScheduleVersionOption[]
  locations: LocationContextResponse[]
  users: NamedTarget[]
  onClose: () => void
  onSuccess: (message: string) => void
  onWarning?: (message: string) => void
}

/** Server cap (spec-16-4 AD-16 / BULK-VAL-001) -- kept in sync with BulkScheduleAssignmentRequest's @Size(max = 500). */
const MAX_SUBJECTS = 500

/**
 * Assign a Work Schedule version + Location to a set of individual people (USER scope only --
 * bulk assignment has no ORGANIZATION/WORKFORCE_GROUP scope, spec-16-4 Intent/AD-16), effective a
 * future date. SPA-only guard (spec Testing & Validation, BULK-UI-VAL-001): the Confirm button
 * stays disabled until a fresh Preview has resolved for the CURRENT selections -- any selection
 * change invalidates it, mirroring ScheduleAssignmentModal's single-assignment guard. The server
 * itself does not require a preview call before commit; this sequencing is a UX guard only.
 */
export function BulkScheduleAssignmentModal({
  versionOptions,
  locations,
  users,
  onClose,
  onSuccess,
  onWarning,
}: BulkScheduleAssignmentModalProps) {
  const { t } = useTranslation(['settings', 'common'])
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([])
  const [scheduleVersionPublicId, setScheduleVersionPublicId] = useState('')
  const [locationPublicId, setLocationPublicId] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [preview, setPreview] = useState<BulkScheduleAssignmentPreviewResponse | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null)
  // DISTRIBUTED_OPERATIONS is denied for every plan through Story 16.4 (mirrors
  // ScheduleAssignmentModal, code review 2026-08-28 on the sibling modal).
  const [capabilityUnavailable, setCapabilityUnavailable] = useState(false)

  const overCap = selectedSubjectIds.length > MAX_SUBJECTS
  const canPreview =
    selectedSubjectIds.length > 0 &&
    !overCap &&
    scheduleVersionPublicId.length > 0 &&
    locationPublicId.length > 0 &&
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

  function memberName(memberPublicId: string): string {
    return users.find((target) => target.publicId === memberPublicId)?.name ?? memberPublicId
  }

  function currentRequest() {
    return {
      subjectIds: selectedSubjectIds,
      scheduleVersionPublicId,
      locationPublicId,
      effectiveFrom,
    }
  }

  function reportFailure(cause: unknown, fallbackKey: string) {
    if (cause instanceof ApiError && cause.problem.code === 'capability-unavailable') {
      setCapabilityUnavailable(true)
      onWarning?.(t('settings:schedules.bulkAssignment.errors.capabilityUnavailable'))
      return
    }
    if (cause instanceof ApiError && cause.problem.code === 'bulk-schedule-assignment-conflict') {
      onWarning?.(t('settings:schedules.bulkAssignment.errors.conflict'))
      return
    }
    if (cause instanceof ApiError && cause.problem.code === 'bulk-schedule-assignment-idempotency-conflict') {
      // Idempotency key already resolved against different evidence -- reusing it reproduces the
      // conflict forever, so drop it and send the admin back to preview (mirrors
      // PolicySettingsPage's equivalent publish-idempotency-conflict handling).
      setPreview(null)
      setIdempotencyKey(null)
      onWarning?.(t('settings:schedules.bulkAssignment.errors.idempotencyConflict'))
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
      // Modal guard: never let a submit reach the server with an incomplete or over-cap
      // selection (spec Testing & Validation SPA-only rule, BULK-UI-VAL-001).
      onWarning?.(
        t(
          overCap
            ? 'settings:schedules.bulkAssignment.errors.overCap'
            : 'settings:schedules.bulkAssignment.errors.incomplete',
        ),
      )
      return
    }
    setPreviewing(true)
    try {
      const result = await previewBulkScheduleAssignment(currentRequest())
      setPreview(result)
      setIdempotencyKey(crypto.randomUUID())
    } catch (cause) {
      reportFailure(cause, 'settings:schedules.bulkAssignment.errors.preview')
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
      await commitBulkScheduleAssignment(idempotencyKey, currentRequest())
      onSuccess(t('settings:schedules.bulkAssignment.created', { count: selectedSubjectIds.length }))
      onClose()
    } catch (cause) {
      reportFailure(cause, 'settings:schedules.bulkAssignment.errors.commit')
    } finally {
      setCommitting(false)
    }
  }

  return (
    <Modal
      labelledBy="bulk-schedule-assignment-modal-title"
      onClose={onClose}
      testId="bulk-schedule-assignment-modal"
      className="modal-wide"
    >
      <div className="modal-header">
        <span className="modal-title" id="bulk-schedule-assignment-modal-title">
          {t('settings:schedules.bulkAssignment.modalTitle')}
        </span>
        <button type="button" className="modal-close" onClick={onClose} aria-label={t('common:actions.close')}>
          <CloseIcon size={18} />
        </button>
      </div>

      <div className="form-group">
        <label id="bulk-assignment-subjects-label">{t('settings:schedules.bulkAssignment.subjects')}</label>
        <ul
          aria-labelledby="bulk-assignment-subjects-label"
          data-testid="bulk-assignment-subjects-list"
          className="checkbox-list"
        >
          {users.map((target) => (
            <li key={target.publicId}>
              <label>
                <input
                  type="checkbox"
                  checked={selectedSubjectIds.includes(target.publicId ?? '')}
                  disabled={previewing || committing}
                  onChange={() => toggleSubject(target.publicId ?? '')}
                />
                <span dir="auto">{target.name}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="form-hint" data-testid="bulk-assignment-selected-count">
          {t('settings:schedules.bulkAssignment.selectedCount', { count: selectedSubjectIds.length })}
        </p>
        {overCap && (
          <p className="form-hint" role="alert" data-testid="bulk-assignment-over-cap">
            {t('settings:schedules.bulkAssignment.errors.overCap')}
          </p>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="bulk-assignment-version">{t('settings:schedules.bulkAssignment.scheduleVersion')}</label>
        <select
          id="bulk-assignment-version"
          value={scheduleVersionPublicId}
          disabled={previewing || committing}
          onChange={(event) => {
            setScheduleVersionPublicId(event.target.value)
            invalidatePreview()
          }}
        >
          <option value="">{t('settings:schedules.bulkAssignment.selectScheduleVersion')}</option>
          {versionOptions.map((option) => (
            <option key={option.versionPublicId} value={option.versionPublicId}>
              {t('settings:schedules.bulkAssignment.versionOption', {
                // The schedule name is user data interpolated into translated copy, so it needs
                // isolation rather than dir="auto" (src/i18n/bidi.ts).
                scheduleName: isolate(option.scheduleName),
                versionNumber: option.versionNumber,
              })}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="bulk-assignment-location">{t('settings:schedules.bulkAssignment.location')}</label>
        <select
          id="bulk-assignment-location"
          value={locationPublicId}
          disabled={previewing || committing}
          onChange={(event) => {
            setLocationPublicId(event.target.value)
            invalidatePreview()
          }}
        >
          <option value="">{t('settings:schedules.bulkAssignment.selectLocation')}</option>
          {locations.map((location) => (
            <option key={location.locationPublicId} value={location.locationPublicId} dir="auto">
              {location.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="bulk-assignment-effective-from">{t('settings:schedules.bulkAssignment.effectiveFrom')}</label>
        <DateField
          id="bulk-assignment-effective-from"
          value={effectiveFrom}
          disabled={previewing || committing}
          onChange={(value) => {
            setEffectiveFrom(value)
            invalidatePreview()
          }}
        />
      </div>

      {capabilityUnavailable && (
        <p className="form-hint" role="alert" data-testid="bulk-assignment-capability-unavailable">
          {t('settings:schedules.bulkAssignment.errors.capabilityUnavailable')}
        </p>
      )}

      <section className="settings-card" aria-live="polite" data-testid="bulk-assignment-preview-panel">
        <h3>{t('settings:schedules.bulkAssignment.previewTitle')}</h3>
        {!preview ? (
          <p>{t('settings:schedules.bulkAssignment.previewEmpty')}</p>
        ) : (
          <>
            <p data-testid="bulk-assignment-affected-count">
              {t('settings:schedules.bulkAssignment.previewAffected', { count: preview.affectedMemberCount })}
            </p>
            {preview.conflicts.length > 0 && (
              <ul data-testid="bulk-assignment-conflicts">
                {preview.conflicts.map((conflict) => (
                  <li key={conflict.subjectId}>
                    {/* The member name is user data interpolated into translated copy, so it needs
                        isolation, exactly like versionOption's scheduleName above. `defaultValue`
                        was dropped: i18n's parseMissingKeyHandler returns '' and wins over it, so
                        it never rendered anything (code review 2026-08-30). */}
                    {t('settings:schedules.bulkAssignment.conflictReasons.' + conflict.reason, {
                      name: isolate(memberName(conflict.subjectId)),
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
          data-testid="bulk-assignment-preview-submit"
          disabled={!canPreview || previewing || committing || capabilityUnavailable}
          onClick={() => void handlePreview()}
        >
          {previewing
            ? t('settings:schedules.bulkAssignment.previewing')
            : t('settings:schedules.bulkAssignment.actions.preview')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="bulk-assignment-confirm-submit"
          disabled={!preview || !idempotencyKey || committing || capabilityUnavailable}
          onClick={() => void handleConfirm()}
        >
          {t('settings:schedules.bulkAssignment.actions.confirm')}
        </button>
      </div>
    </Modal>
  )
}
