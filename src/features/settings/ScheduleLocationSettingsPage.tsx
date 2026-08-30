import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { isolate } from '../../i18n/bidi'
import {
  ApiError,
  getWorkSchedules,
  createWorkSchedule,
  createWorkScheduleVersion,
  getLocationContexts,
  createLocationContext,
  listScheduleAssignments,
  getPolicySettingsOverview,
} from '../../api/client'
import type { DayOfWeek } from '../../api/generated/types'
import type { components } from '../../api/generated/types'
import { useAuth } from '../../auth/useAuth'
import { useToast } from '../../components/ui/useToast'
import { Modal } from '../../components/ui/Modal'
import { PlusIcon, CloseIcon, CalendarIcon } from '../../components/ui/icons'
import { WEEKEND_DAYS_DISPLAY } from './weekendDays'
import { ScheduleAssignmentModal, type ScheduleVersionOption } from './ScheduleAssignmentModal'
import { BulkScheduleAssignmentModal } from './BulkScheduleAssignmentModal'
import './team-members.css'
// .weekend-chips/.weekend-chip and .settings-list-body live in these two files. They currently
// resolve only because SettingsPage happens to load them first; importing them here keeps the
// component styled wherever it renders (code review 2026-08-28).
import './weekend-day-chips.css'
import './group-tabs.css'

type NamedTarget = components['schemas']['NamedTarget']

type ScheduleLocationSettingsPageProps = {
  // This is a Settings category panel, mounted by SettingsPage -- not a route.
  // Every other Settings category works the same way; PolicySettingsPage's own
  // route is a drill-in draft editor (/settings/leave-policies/:draftPublicId),
  // not a category. Corrected 2026-08-28: the comment here previously claimed a
  // top-level lazy route that was never registered.
  // Embedded use passes the parent's toast callbacks so a single success/warning
  // surface serves the whole page; standalone use falls back to its own useToast().
  onSuccess?: (message: string) => void
  onWarning?: (message: string) => void
}

/** ISO date -> the viewer's locale. Falls back to the raw value if it is not a parseable date. */
function formatEffectiveFrom(isoDate: string, language: string): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    return isoDate
  }
  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

const DEFAULT_WORKING_DAYS: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
]

/**
 * Story 16.1: multiple Work Schedules + Location Contexts, and the effective-dated
 * Organization/Workforce Group/User assignment that pairs them. Reads
 * {@code getPolicySettingsOverview} purely for its generic {@code users}/{@code workforceGroups}
 * NamedTarget lists (the only existing endpoint exposing organizational public ids by name) --
 * this page owns no Policy data and does not otherwise depend on the Policy feature.
 */
export function ScheduleLocationSettingsPage({
  onSuccess: onSuccessProp,
  onWarning: onWarningProp,
}: ScheduleLocationSettingsPageProps) {
  const { t, i18n } = useTranslation(['settings', 'common'])
  const { user } = useAuth()
  const orgId = user?.organizationId
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const onSuccess = onSuccessProp ?? ((message: string) => showToast(message, 'success'))
  const onWarning = onWarningProp ?? ((message: string) => showToast(message, 'warning'))

  const schedulesQuery = useQuery({
    queryKey: ['work-schedules', orgId] as const,
    queryFn: getWorkSchedules,
    enabled: orgId != null,
  })
  const locationsQuery = useQuery({
    queryKey: ['location-contexts', orgId] as const,
    queryFn: getLocationContexts,
    enabled: orgId != null,
  })
  const assignmentsQuery = useQuery({
    queryKey: ['schedule-assignments', orgId] as const,
    queryFn: listScheduleAssignments,
    enabled: orgId != null,
  })
  // getPolicySettingsOverview is read purely for its generic users/workforceGroups NamedTarget
  // lists. It is keyed under this feature rather than reusing the Policy feature's key, so a
  // Policy-side invalidation cannot silently drive this page's cache (code review 2026-08-28).
  const overviewQuery = useQuery({
    queryKey: ['schedule-subject-targets', orgId] as const,
    queryFn: getPolicySettingsOverview,
    enabled: orgId != null,
  })

  const schedules = schedulesQuery.data ?? []
  const locations = locationsQuery.data ?? []
  const assignments = assignmentsQuery.data ?? []
  const workforceGroups: NamedTarget[] = overviewQuery.data?.workforceGroups ?? []
  const users: NamedTarget[] = overviewQuery.data?.users ?? []

  const versionOptions: ScheduleVersionOption[] = useMemo(
    () =>
      (schedulesQuery.data ?? []).flatMap((schedule) =>
        schedule.versions.map((version) => ({
          scheduleName: schedule.name,
          versionPublicId: version.versionPublicId,
          versionNumber: version.versionNumber,
        })),
      ),
    [schedulesQuery.data],
  )

  // DISTRIBUTED_OPERATIONS stays COMING_SOON on every plan until Story 16.5's release gate is
  // flipped, so every mutation here is denied for every plan today. Without this the page rendered "nothing
  // configured yet, create one" with buttons that could only ever fail (code review 2026-08-28).
  const [capabilityUnavailable, setCapabilityUnavailable] = useState(false)
  useEffect(() => {
    const denied = [schedulesQuery.error, locationsQuery.error, assignmentsQuery.error].some(
      (error) => error instanceof ApiError && error.problem.code === 'capability-unavailable',
    )
    if (denied) setCapabilityUnavailable(true)
  }, [schedulesQuery.error, locationsQuery.error, assignmentsQuery.error])

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [bulkAssignmentModalOpen, setBulkAssignmentModalOpen] = useState(false)
  const [versionTargetSchedulePublicId, setVersionTargetSchedulePublicId] = useState<string | null>(null)

  function invalidateAfterWrite() {
    void queryClient.invalidateQueries({ queryKey: ['work-schedules', orgId] })
    void queryClient.invalidateQueries({ queryKey: ['location-contexts', orgId] })
    void queryClient.invalidateQueries({ queryKey: ['schedule-assignments', orgId] })
  }

  function locationName(locationPublicId: string): string {
    return locations.find((location) => location.locationPublicId === locationPublicId)?.name ?? locationPublicId
  }

  function subjectLabel(scope: string, subjectPublicId: string | undefined): string {
    if (scope === 'ORGANIZATION' || !subjectPublicId) {
      return t('settings:schedules.assignment.scopes.organization')
    }
    const pool = scope === 'USER' ? users : workforceGroups
    return pool.find((target) => target.publicId === subjectPublicId)?.name ?? subjectPublicId
  }

  return (
    <div className="settings-card">
      <header className="card-header">
        <h2 className="card-title">{t('settings:schedules.title')}</h2>
        <p className="body-text">{t('settings:schedules.subtitle')}</p>
      </header>

      {capabilityUnavailable && (
        <p className="form-hint" role="alert" data-testid="schedules-capability-unavailable">
          {t('settings:schedules.capabilityUnavailable')}
        </p>
      )}

      <section aria-labelledby="schedules-section-title">
        <div className="card-section-header">
          <h3 id="schedules-section-title" className="card-section-title">{t('settings:schedules.sections.schedules')}</h3>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            data-testid="new-work-schedule"
            disabled={capabilityUnavailable}
            onClick={() => setScheduleModalOpen(true)}
          >
            <PlusIcon size={16} /> {t('settings:schedules.actions.newSchedule')}
          </button>
        </div>
        {schedules.length === 0 ? (
          <div className="dashboard-empty-state" data-testid="work-schedule-empty-state" role="status">
            <span aria-hidden="true">
              <CalendarIcon size={36} />
            </span>
            <p>{t('settings:schedules.empty.schedules')}</p>
          </div>
        ) : (
          <div className="settings-list-body" data-testid="work-schedule-list">
            {schedules.map((schedule) => (
              <div key={schedule.schedulePublicId} className="settings-list-item">
                <span dir="auto">{schedule.name}</span>
                <span className="body-text">
                  {schedule.versions
                    .map((version) =>
                      t('settings:schedules.schedule.versionSummary', {
                        versionNumber: version.versionNumber,
                        // Raw DayOfWeek names ("MONDAY, TUESDAY") reached the UI untranslated in
                        // both locales; settings:days.* already carries them (code review
                        // 2026-08-28).
                        days: version.workingDays.map((day) => t(`settings:days.${day}`)).join(', '),
                      }),
                    )
                    .join(' · ')}
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  // The raw name, not isolate(): bidi isolation marks are for rendered text, and
                  // in an accessible name they only pollute what a screen reader announces.
                  aria-label={t('settings:schedules.actions.newVersionFor', {
                    scheduleName: schedule.name,
                  })}
                  onClick={() => setVersionTargetSchedulePublicId(schedule.schedulePublicId)}
                >
                  {t('settings:schedules.actions.newVersion')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="locations-section-title">
        <div className="card-section-header">
          <h3 id="locations-section-title" className="card-section-title">{t('settings:schedules.sections.locations')}</h3>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            data-testid="new-location-context"
            disabled={capabilityUnavailable}
            onClick={() => setLocationModalOpen(true)}
          >
            <PlusIcon size={16} /> {t('settings:schedules.actions.newLocation')}
          </button>
        </div>
        {locations.length === 0 ? (
          <div className="dashboard-empty-state" data-testid="location-context-empty-state" role="status">
            <span aria-hidden="true">
              <CalendarIcon size={36} />
            </span>
            <p>{t('settings:schedules.empty.locations')}</p>
          </div>
        ) : (
          <div className="settings-list-body" data-testid="location-context-list">
            {locations.map((location) => (
              <div key={location.locationPublicId} className="settings-list-item">
                <span dir="auto">{location.name}</span>
                <span className="body-text">{location.ianaTimezone}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="assignments-section-title">
        <div className="card-section-header">
          <h3 id="assignments-section-title" className="card-section-title">{t('settings:schedules.sections.assignments')}</h3>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            data-testid="new-schedule-assignment"
            disabled={capabilityUnavailable || versionOptions.length === 0 || locations.length === 0}
            onClick={() => setAssignmentModalOpen(true)}
          >
            <PlusIcon size={16} /> {t('settings:schedules.actions.newAssignment')}
          </button>
          {/* Story 16.4: bulk (USER-scope only) assignment. Same preconditions as the single
              assignment above, plus at least one person to assign. */}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            data-testid="new-bulk-schedule-assignment"
            disabled={
              capabilityUnavailable ||
              versionOptions.length === 0 ||
              locations.length === 0 ||
              users.length === 0
            }
            onClick={() => setBulkAssignmentModalOpen(true)}
          >
            <PlusIcon size={16} /> {t('settings:schedules.actions.bulkAssignment')}
          </button>
        </div>
        {assignments.length === 0 ? (
          <div className="dashboard-empty-state" data-testid="schedule-assignment-empty-state" role="status">
            <span aria-hidden="true">
              <CalendarIcon size={36} />
            </span>
            <p>{t('settings:schedules.empty.assignments')}</p>
          </div>
        ) : (
          <div className="settings-list-body" data-testid="schedule-assignment-list">
            {assignments.map((assignment) => (
              <div key={assignment.assignmentPublicId} className="settings-list-item">
                <span dir="auto">{subjectLabel(assignment.scope, assignment.subjectPublicId)}</span>
                <span className="body-text" dir="auto">{locationName(assignment.locationPublicId)}</span>
                {/* L9: a status indicator carries a text label, and the date is formatted for the
                    active locale rather than shown as a raw ISO string (code review 2026-08-28). */}
                <span className="body-text">
                  {t('settings:schedules.assignment.effectiveFromValue', {
                    date: formatEffectiveFrom(assignment.effectiveFrom, i18n.language),
                  })}
                </span>
                <span className="body-text">
                  {t('settings:schedules.assignment.previewAffected', {
                    count: assignment.affectedMemberCount,
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {scheduleModalOpen && (
        <NewWorkScheduleModal
          onClose={() => setScheduleModalOpen(false)}
          onSuccess={(message) => {
            invalidateAfterWrite()
            onSuccess(message)
          }}
          onWarning={onWarning}
        />
      )}

      {versionTargetSchedulePublicId && (
        <NewWorkScheduleVersionModal
          schedulePublicId={versionTargetSchedulePublicId}
          onClose={() => setVersionTargetSchedulePublicId(null)}
          onSuccess={(message) => {
            invalidateAfterWrite()
            onSuccess(message)
          }}
          onWarning={onWarning}
        />
      )}

      {locationModalOpen && (
        <NewLocationContextModal
          workforceGroups={workforceGroups}
          onClose={() => setLocationModalOpen(false)}
          onSuccess={(message) => {
            invalidateAfterWrite()
            onSuccess(message)
          }}
          onWarning={onWarning}
        />
      )}

      {assignmentModalOpen && (
        <ScheduleAssignmentModal
          versionOptions={versionOptions}
          locations={locations}
          workforceGroups={workforceGroups}
          users={users}
          onClose={() => setAssignmentModalOpen(false)}
          onSuccess={(message) => {
            invalidateAfterWrite()
            onSuccess(message)
          }}
          onWarning={onWarning}
        />
      )}

      {bulkAssignmentModalOpen && (
        <BulkScheduleAssignmentModal
          versionOptions={versionOptions}
          locations={locations}
          users={users}
          onClose={() => setBulkAssignmentModalOpen(false)}
          onSuccess={(message) => {
            invalidateAfterWrite()
            onSuccess(message)
          }}
          onWarning={onWarning}
        />
      )}
    </div>
  )
}

type NewWorkScheduleModalProps = {
  onClose: () => void
  onSuccess: (message: string) => void
  onWarning?: (message: string) => void
}

function NewWorkScheduleModal({ onClose, onSuccess, onWarning }: NewWorkScheduleModalProps) {
  const { t } = useTranslation(['settings', 'common'])
  const [name, setName] = useState('')
  const [workingDays, setWorkingDays] = useState<DayOfWeek[]>(DEFAULT_WORKING_DAYS)
  const [submitting, setSubmitting] = useState(false)

  function toggleDay(day: DayOfWeek, checked: boolean) {
    setWorkingDays(checked ? [...workingDays, day] : workingDays.filter((value) => value !== day))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }
    if (workingDays.length === 0) {
      // Modal guard: never submit a schedule with zero working days selected --
      // the server would reject it, but the SPA should not even try.
      onWarning?.(t('settings:schedules.schedule.selectWorkingDays'))
      return
    }
    setSubmitting(true)
    try {
      await createWorkSchedule({ name: trimmedName, workingDays })
      onSuccess(t('settings:schedules.schedule.created', { name: isolate(trimmedName) }))
      onClose()
    } catch {
      onWarning?.(t('settings:schedules.schedule.errors.create'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal labelledBy="new-schedule-modal-title" onClose={onClose} testId="new-work-schedule-modal">
      <div className="modal-header">
        <span className="modal-title" id="new-schedule-modal-title">
          {t('settings:schedules.schedule.modalTitle')}
        </span>
        <button type="button" className="modal-close" onClick={onClose} aria-label={t('common:actions.close')}>
          <CloseIcon size={18} />
        </button>
      </div>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className="form-group">
          <label htmlFor="schedule-name">{t('settings:schedules.schedule.name')}</label>
          <input
            id="schedule-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('settings:schedules.schedule.namePlaceholder')}
            required
          />
        </div>
        <div className="form-group">
          <label>{t('settings:schedules.schedule.workingDays')}</label>
          <div className="weekend-chips">
            {WEEKEND_DAYS_DISPLAY.map(({ value }) => {
              const label = t(`settings:days.${value}`)
              const isActive = workingDays.includes(value)
              return (
                <label
                  key={value}
                  className={`weekend-chip${isActive ? ' active' : ''}${submitting ? ' disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    disabled={submitting}
                    onChange={(event) => toggleDay(value, event.target.checked)}
                  />
                  {label}
                </label>
              )
            })}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
            {t('common:actions.cancel')}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            data-testid="create-work-schedule-submit"
            disabled={submitting || name.trim().length === 0 || workingDays.length === 0}
          >
            {t('settings:schedules.actions.newSchedule')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

type NewWorkScheduleVersionModalProps = {
  schedulePublicId: string
  onClose: () => void
  onSuccess: (message: string) => void
  onWarning?: (message: string) => void
}

function NewWorkScheduleVersionModal({
  schedulePublicId,
  onClose,
  onSuccess,
  onWarning,
}: NewWorkScheduleVersionModalProps) {
  const { t } = useTranslation(['settings', 'common'])
  const [workingDays, setWorkingDays] = useState<DayOfWeek[]>(DEFAULT_WORKING_DAYS)
  const [submitting, setSubmitting] = useState(false)

  function toggleDay(day: DayOfWeek, checked: boolean) {
    setWorkingDays(checked ? [...workingDays, day] : workingDays.filter((value) => value !== day))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (workingDays.length === 0) {
      onWarning?.(t('settings:schedules.schedule.selectWorkingDays'))
      return
    }
    setSubmitting(true)
    try {
      await createWorkScheduleVersion(schedulePublicId, { workingDays })
      onSuccess(t('settings:schedules.schedule.versionCreated'))
      onClose()
    } catch {
      onWarning?.(t('settings:schedules.schedule.errors.createVersion'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal labelledBy="new-version-modal-title" onClose={onClose} testId="new-work-schedule-version-modal">
      <div className="modal-header">
        <span className="modal-title" id="new-version-modal-title">
          {t('settings:schedules.schedule.versionModalTitle')}
        </span>
        <button type="button" className="modal-close" onClick={onClose} aria-label={t('common:actions.close')}>
          <CloseIcon size={18} />
        </button>
      </div>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className="form-group">
          <label>{t('settings:schedules.schedule.workingDays')}</label>
          <div className="weekend-chips">
            {WEEKEND_DAYS_DISPLAY.map(({ value }) => {
              const label = t(`settings:days.${value}`)
              const isActive = workingDays.includes(value)
              return (
                <label
                  key={value}
                  className={`weekend-chip${isActive ? ' active' : ''}${submitting ? ' disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    disabled={submitting}
                    onChange={(event) => toggleDay(value, event.target.checked)}
                  />
                  {label}
                </label>
              )
            })}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
            {t('common:actions.cancel')}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || workingDays.length === 0}
          >
            {t('settings:schedules.actions.newVersion')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

type NewLocationContextModalProps = {
  workforceGroups: NamedTarget[]
  onClose: () => void
  onSuccess: (message: string) => void
  onWarning?: (message: string) => void
}

function NewLocationContextModal({
  workforceGroups,
  onClose,
  onSuccess,
  onWarning,
}: NewLocationContextModalProps) {
  const { t } = useTranslation(['settings', 'common'])
  const [name, setName] = useState('')
  const [ianaTimezone, setIanaTimezone] = useState('')
  const [holidayWorkforceGroupPublicId, setHolidayWorkforceGroupPublicId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedZone = ianaTimezone.trim()
    if (!trimmedName || !trimmedZone || !holidayWorkforceGroupPublicId) {
      // Modal guard: never submit with a required selection missing.
      onWarning?.(t('settings:schedules.location.errors.incomplete'))
      return
    }
    setSubmitting(true)
    try {
      await createLocationContext({
        name: trimmedName,
        ianaTimezone: trimmedZone,
        holidayWorkforceGroupPublicId,
      })
      onSuccess(t('settings:schedules.location.created', { name: isolate(trimmedName) }))
      onClose()
    } catch {
      onWarning?.(t('settings:schedules.location.errors.create'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal labelledBy="new-location-modal-title" onClose={onClose} testId="new-location-context-modal">
      <div className="modal-header">
        <span className="modal-title" id="new-location-modal-title">
          {t('settings:schedules.location.modalTitle')}
        </span>
        <button type="button" className="modal-close" onClick={onClose} aria-label={t('common:actions.close')}>
          <CloseIcon size={18} />
        </button>
      </div>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className="form-group">
          <label htmlFor="location-name">{t('settings:schedules.location.name')}</label>
          <input
            id="location-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('settings:schedules.location.namePlaceholder')}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="location-timezone">{t('settings:schedules.location.timezone')}</label>
          <input
            id="location-timezone"
            type="text"
            value={ianaTimezone}
            onChange={(event) => setIanaTimezone(event.target.value)}
            placeholder={t('settings:schedules.location.timezonePlaceholder')}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="location-holiday-source">{t('settings:schedules.location.holidaySource')}</label>
          <select
            id="location-holiday-source"
            value={holidayWorkforceGroupPublicId}
            onChange={(event) => setHolidayWorkforceGroupPublicId(event.target.value)}
            required
          >
            <option value="">{t('settings:schedules.location.selectHolidaySource')}</option>
            {workforceGroups.map((group) => (
              <option key={group.publicId} value={group.publicId}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
            {t('common:actions.cancel')}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            data-testid="create-location-context-submit"
            disabled={
              submitting ||
              name.trim().length === 0 ||
              ianaTimezone.trim().length === 0 ||
              !holidayWorkforceGroupPublicId
            }
          >
            {t('settings:schedules.actions.newLocation')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
