import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, previewScheduleAssignment, commitScheduleAssignment } from '../../api/client'
import type {
  LocationContextResponse,
  ScheduleAssignmentPreviewResponse,
  ScheduleAssignmentRequest,
} from '../../api/generated/types'
import type { components } from '../../api/generated/types'
import { isolate } from '../../i18n/bidi'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'
import { DateField } from '../../components/DateField'
import './team-members.css'
// .settings-card / .form-group come from team-members.css above; the modal chrome is the shared
// Modal's own stylesheet. Imported explicitly rather than relying on SettingsPage having loaded
// them first, which stops holding the moment this renders anywhere else (code review 2026-08-28).
import '../../components/ui/modal.css'

type NamedTarget = components['schemas']['NamedTarget']
type AssignmentScope = ScheduleAssignmentRequest['scope']

export type ScheduleVersionOption = {
  scheduleName: string
  versionPublicId: string
  versionNumber: number
}

type ScheduleAssignmentModalProps = {
  versionOptions: ScheduleVersionOption[]
  locations: LocationContextResponse[]
  workforceGroups: NamedTarget[]
  users: NamedTarget[]
  onClose: () => void
  onSuccess: (message: string) => void
  onWarning?: (message: string) => void
}

/**
 * Assign a Work Schedule version + Location to an Organization/Workforce Group/User, effective a
 * future date. SPA-only guard (spec Testing & Validation): the Confirm button stays disabled until
 * a fresh Preview has resolved for the CURRENT selections -- any field change invalidates it, so an
 * HR admin can never commit an assignment whose affected-member count they have not just seen. The
 * server itself does not require a preview call before commit; this sequencing is a UX guard only.
 */
export function ScheduleAssignmentModal({
  versionOptions,
  locations,
  workforceGroups,
  users,
  onClose,
  onSuccess,
  onWarning,
}: ScheduleAssignmentModalProps) {
  const { t } = useTranslation(['settings', 'common'])
  const [scope, setScope] = useState<AssignmentScope>('ORGANIZATION')
  const [subjectPublicId, setSubjectPublicId] = useState('')
  const [scheduleVersionPublicId, setScheduleVersionPublicId] = useState('')
  const [locationPublicId, setLocationPublicId] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [preview, setPreview] = useState<ScheduleAssignmentPreviewResponse | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [committing, setCommitting] = useState(false)
  // DISTRIBUTED_OPERATIONS stays COMING_SOON on every plan until Story 16.5's release gate is
  // flipped, so a denial is the response an HR admin actually gets today. It is not retryable, and the generic "Try again"
  // copy invited a doomed retry (code review 2026-08-28).
  const [capabilityUnavailable, setCapabilityUnavailable] = useState(false)

  const subjectRequired = scope !== 'ORGANIZATION'
  const canPreview =
    scheduleVersionPublicId.length > 0 &&
    locationPublicId.length > 0 &&
    effectiveFrom.length > 0 &&
    (!subjectRequired || subjectPublicId.length > 0)

  function invalidatePreview() {
    setPreview(null)
  }

  /** The preview returns member public ids; the caller already holds the names for them. */
  function memberName(memberPublicId: string): string {
    return users.find((target) => target.publicId === memberPublicId)?.name ?? memberPublicId
  }

  function currentRequest(): ScheduleAssignmentRequest {
    return {
      scope,
      subjectPublicId: subjectRequired ? subjectPublicId : undefined,
      scheduleVersionPublicId,
      locationPublicId,
      effectiveFrom,
    }
  }

  /**
   * Maps a failure onto the copy that actually describes it. A `capability-unavailable` 403 is
   * permanent (the capability is not promoted yet), and a `schedule-assignment-conflict` 409 means
   * this exact scope/subject/date triple is taken — retrying either one unchanged cannot succeed,
   * so neither may show the generic retry copy (code review 2026-08-28).
   */
  function reportFailure(cause: unknown, fallbackKey: string) {
    if (cause instanceof ApiError && cause.problem.code === 'capability-unavailable') {
      setCapabilityUnavailable(true)
      onWarning?.(t('settings:schedules.assignment.errors.capabilityUnavailable'))
      return
    }
    if (cause instanceof ApiError && cause.problem.code === 'schedule-assignment-conflict') {
      onWarning?.(t('settings:schedules.assignment.errors.conflict'))
      return
    }
    if (cause instanceof ApiError && cause.fieldViolations?.effectiveFrom?.length) {
      // FieldViolationMap values are string[] (one field can carry several violations), so join
      // rather than passing the array where a string is expected. Pre-existing Story 16.1 type
      // error, fixed here because it blocked `tsc -b` for Story 16.2's own verification.
      onWarning?.(cause.fieldViolations.effectiveFrom.join(' '))
      return
    }
    onWarning?.(t(fallbackKey))
  }

  async function handlePreview() {
    if (!canPreview) {
      // Modal guard: never let a submit reach the server with an incomplete
      // selection (spec Testing & Validation SPA-only rule).
      onWarning?.(t('settings:schedules.assignment.errors.incomplete'))
      return
    }
    setPreviewing(true)
    try {
      const result = await previewScheduleAssignment(currentRequest())
      setPreview(result)
    } catch (cause) {
      reportFailure(cause, 'settings:schedules.assignment.errors.preview')
    } finally {
      setPreviewing(false)
    }
  }

  async function handleConfirm() {
    if (!preview) {
      return
    }
    setCommitting(true)
    try {
      await commitScheduleAssignment(currentRequest())
      onSuccess(t('settings:schedules.assignment.created'))
      onClose()
    } catch (cause) {
      reportFailure(cause, 'settings:schedules.assignment.errors.commit')
    } finally {
      setCommitting(false)
    }
  }

  return (
    <Modal
      labelledBy="schedule-assignment-modal-title"
      onClose={onClose}
      testId="schedule-assignment-modal"
      className="modal-wide"
    >
      <div className="modal-header">
        <span className="modal-title" id="schedule-assignment-modal-title">
          {t('settings:schedules.assignment.modalTitle')}
        </span>
        <button type="button" className="modal-close" onClick={onClose} aria-label={t('common:actions.close')}>
          <CloseIcon size={18} />
        </button>
      </div>

      <div className="form-group">
        <label htmlFor="assignment-scope">{t('settings:schedules.assignment.scope')}</label>
        <select
          id="assignment-scope"
          value={scope}
          disabled={previewing || committing}
          onChange={(event) => {
            setScope(event.target.value as AssignmentScope)
            setSubjectPublicId('')
            invalidatePreview()
          }}
        >
          <option value="ORGANIZATION">{t('settings:schedules.assignment.scopes.organization')}</option>
          <option value="WORKFORCE_GROUP">{t('settings:schedules.assignment.scopes.group')}</option>
          <option value="USER">{t('settings:schedules.assignment.scopes.user')}</option>
        </select>
      </div>

      {subjectRequired && (
        <div className="form-group">
          <label htmlFor="assignment-subject">{t('settings:schedules.assignment.subject')}</label>
          <select
            id="assignment-subject"
            value={subjectPublicId}
            disabled={previewing || committing}
            onChange={(event) => {
              setSubjectPublicId(event.target.value)
              invalidatePreview()
            }}
          >
            <option value="">{t('settings:schedules.assignment.selectSubject')}</option>
            {(scope === 'USER' ? users : workforceGroups).map((target) => (
              <option key={target.publicId} value={target.publicId} dir="auto">
                {target.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="assignment-version">{t('settings:schedules.assignment.scheduleVersion')}</label>
        <select
          id="assignment-version"
          value={scheduleVersionPublicId}
          disabled={previewing || committing}
          onChange={(event) => {
            setScheduleVersionPublicId(event.target.value)
            invalidatePreview()
          }}
        >
          <option value="">{t('settings:schedules.assignment.selectScheduleVersion')}</option>
          {versionOptions.map((option) => (
            <option key={option.versionPublicId} value={option.versionPublicId}>
              {t('settings:schedules.assignment.versionOption', {
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
        <label htmlFor="assignment-location">{t('settings:schedules.assignment.location')}</label>
        <select
          id="assignment-location"
          value={locationPublicId}
          disabled={previewing || committing}
          onChange={(event) => {
            setLocationPublicId(event.target.value)
            invalidatePreview()
          }}
        >
          <option value="">{t('settings:schedules.assignment.selectLocation')}</option>
          {locations.map((location) => (
            <option key={location.locationPublicId} value={location.locationPublicId} dir="auto">
              {location.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="assignment-effective-from">{t('settings:schedules.assignment.effectiveFrom')}</label>
        <DateField
          id="assignment-effective-from"
          value={effectiveFrom}
          disabled={previewing || committing}
          onChange={(value) => {
            setEffectiveFrom(value)
            invalidatePreview()
          }}
        />
      </div>

      {capabilityUnavailable && (
        <p className="form-hint" role="alert" data-testid="schedule-assignment-capability-unavailable">
          {t('settings:schedules.assignment.errors.capabilityUnavailable')}
        </p>
      )}

      <section className="settings-card" aria-live="polite" data-testid="schedule-assignment-preview-panel">
        <h3>{t('settings:schedules.assignment.previewTitle')}</h3>
        {!preview ? (
          <p>{t('settings:schedules.assignment.previewEmpty')}</p>
        ) : (
          <>
            <p data-testid="schedule-assignment-affected-count">
              {t('settings:schedules.assignment.previewAffected', { count: preview.affectedMemberCount })}
            </p>
            {(preview.shadowedMemberCount ?? 0) > 0 && (
              // Precedence is USER > WORKFORCE_GROUP > ORGANIZATION, and the Story 16.1 migration
              // backfills a group-scope assignment for every existing group — so an
              // organization-wide assignment can legitimately govern nobody. Say why, rather than
              // showing a bare "0 members affected" (code review 2026-08-28).
              <p data-testid="schedule-assignment-shadowed-count">
                {t('settings:schedules.assignment.previewShadowed', {
                  count: preview.shadowedMemberCount ?? 0,
                })}
              </p>
            )}
            {preview.members.length > 0 && (
              <ul data-testid="schedule-assignment-affected-members">
                {preview.members.map((member) => (
                  <li key={member.memberPublicId} dir="auto">
                    {memberName(member.memberPublicId)}
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
          data-testid="schedule-assignment-preview-submit"
          disabled={!canPreview || previewing || committing || capabilityUnavailable}
          onClick={() => void handlePreview()}
        >
          {previewing ? t('settings:schedules.assignment.previewing') : t('settings:schedules.assignment.actions.preview')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="schedule-assignment-confirm-submit"
          disabled={!preview || committing || capabilityUnavailable}
          onClick={() => void handleConfirm()}
        >
          {t('settings:schedules.assignment.actions.confirm')}
        </button>
      </div>
    </Modal>
  )
}
