import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { isolate } from '../../i18n/bidi'
import {
  ApiError,
  getWorkSchedules,
  createWorkSchedule,
  createWorkScheduleVersion,
  getLocationContexts,
  createLocationContext,
  listScheduleAssignments,
  getScheduleAssignmentCoverage,
  getPolicySettingsOverview,
} from '../../api/client'
import type { DayOfWeek } from '../../api/generated/types'
import type { components } from '../../api/generated/types'
import { useAuth } from '../../auth/useAuth'
import { useToast } from '../../components/ui/useToast'
import { Modal } from '../../components/ui/Modal'
import { PlusIcon, CloseIcon, CalendarIcon } from '../../components/ui/icons'
import { HorizontalScrollRegion } from '../../components/ui/HorizontalScrollRegion'
import { WEEKEND_DAYS_DISPLAY } from './weekendDays'
import { ScheduleAssignmentModal, type ScheduleVersionOption } from './ScheduleAssignmentModal'
import { BulkScheduleAssignmentModal } from './BulkScheduleAssignmentModal'
import { WorkingDayStrip } from './WorkingDayStrip'
import './team-members.css'
// .weekend-chips/.weekend-chip, .day-strip and .schedule-assignments-table live in these two
// files. They currently resolve only because SettingsPage happens to load them first; importing
// them here keeps the component styled wherever it renders (code review 2026-08-28).
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
  // Coverage is the one figure on this screen that is counted over users rather than over
  // assignment rows, so it cannot be derived from assignmentsQuery: the three scopes overlap, and
  // adding up each row's affectedMemberCount reports more covered people than the organization
  // has. The server answers it as one distinct-member question.
  const coverageQuery = useQuery({
    queryKey: ['schedule-assignment-coverage', orgId] as const,
    queryFn: getScheduleAssignmentCoverage,
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
  const coverage = coverageQuery.data
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
    void queryClient.invalidateQueries({ queryKey: ['schedule-assignment-coverage', orgId] })
  }

  // An assignment IS a schedule-and-location pairing, so a table that named only the location
  // showed half of each record. The version matters as much as the schedule: assigning v1 and
  // assigning v2 of the same schedule are different decisions.
  function scheduleLabel(versionPublicId: string): string {
    const version = versionOptions.find((option) => option.versionPublicId === versionPublicId)
    if (!version) {
      return versionPublicId
    }
    return t('settings:schedules.assignment.columns.scheduleValue', {
      schedule: version.scheduleName,
      versionNumber: version.versionNumber,
    })
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

  // The rail speaks only when it has something to say -- a card headed "Heads up" holding
  // nothing is worse than no card. Both lines come from data already on this page.
  const headsUp: string[] = []
  if (coverage != null && coverage.unassignedMemberCount > 0) {
    headsUp.push(t('settings:schedules.headsUp.unassigned'))
  }
  const distinctTimezones = new Set(locations.map((location) => location.ianaTimezone))
  if (locations.length > 1 && distinctTimezones.size === 1) {
    headsUp.push(
      t('settings:schedules.headsUp.singleTimezone', {
        timezone: isolate([...distinctTimezones][0]),
      }),
    )
  }

  return (
    <div className="panel-stack">
      {capabilityUnavailable && (
        <p className="form-hint" role="alert" data-testid="schedules-capability-unavailable">
          {t('settings:schedules.capabilityUnavailable')}
        </p>
      )}

      {/* The panel carries its own supporting rail rather than adding a third track to the
          Settings grid -- SettingsPage should not have to know which category wants one. At the
          layout's 1280px cap the reading column is 1024px, so a 300px rail leaves 700px: enough
          for these two record lists stacked, and not enough for them side by side once each row
          holds a name, a day strip and an action. The assignments table spans both tracks
          underneath, because its own 760px floor would scroll inside 700px. */}
      <div className="panel-with-aside">
        <div className="panel-stack">
          <section className="settings-card" aria-labelledby="schedules-section-title">
            <div className="card-header">
              <div className="card-header-text">
                <h3 id="schedules-section-title" className="card-title">
                  {t('settings:schedules.sections.schedules')}
                </h3>
                <p className="card-description">{t('settings:schedules.schedule.cardDescription')}</p>
              </div>
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
              <div className="settings-rows" data-testid="work-schedule-list">
                {schedules.map((schedule) => {
                  const versions = schedule.versions ?? []
                  const latest = versions[versions.length - 1]
                  return (
                    <div className="settings-row" key={schedule.schedulePublicId}>
                      <div className="settings-row-main">
                        <div className="settings-row-title" dir="auto">
                          {schedule.name}
                        </div>
                        {latest && (
                          <div className="settings-row-meta">
                            {t('settings:schedules.schedule.versionLabel', {
                              versionNumber: latest.versionNumber,
                            })}
                          </div>
                        )}
                      </div>
                      <div className="settings-row-actions">
                        {latest && (
                          <WorkingDayStrip
                            workingDays={latest.workingDays}
                            // Every version, not just the latest: the sentence is the strip's text
                            // alternative and the only place the full history is readable. Raw
                            // DayOfWeek names ("MONDAY, TUESDAY") reached the UI untranslated in both
                            // locales; settings:days.* already carries them (code review 2026-08-28).
                            label={versions
                              .map((version) =>
                                t('settings:schedules.schedule.versionSummary', {
                                  versionNumber: version.versionNumber,
                                  days: version.workingDays
                                    .map((day) => t(`settings:days.${day}`))
                                    .join(', '),
                                }),
                              )
                              .join(' · ')}
                          />
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
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
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="settings-card" aria-labelledby="locations-section-title">
            <div className="card-header">
              <div className="card-header-text">
                <h3 id="locations-section-title" className="card-title">
                  {t('settings:schedules.sections.locations')}
                </h3>
                <p className="card-description">{t('settings:schedules.location.cardDescription')}</p>
              </div>
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
              <div className="settings-rows" data-testid="location-context-list">
                {locations.map((location) => (
                  <div className="settings-row" key={location.locationPublicId}>
                    <div className="settings-row-main">
                      <div className="settings-row-title" dir="auto">
                        {location.name}
                      </div>
                      <div className="settings-row-meta">{location.ianaTimezone}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="support-rail">
          <section className="support-note" aria-labelledby="schedules-coverage-title">
            <h3 className="support-note-title" id="schedules-coverage-title">
              {t('settings:schedules.coverage.title')}
            </h3>
            <dl className="support-note-list">
              <div className="support-note-kv">
                <dt>{t('settings:schedules.coverage.peopleCovered')}</dt>
                <dd data-testid="coverage-people-covered">
                  {coverage
                    ? t('settings:schedules.coverage.ofTotal', {
                        covered: coverage.coveredMemberCount,
                        total: coverage.activeMemberCount,
                      })
                    : '\u2014'}
                </dd>
              </div>
              <div className="support-note-kv">
                <dt>{t('settings:schedules.coverage.unassigned')}</dt>
                <dd data-testid="coverage-unassigned">
                  {coverage ? coverage.unassignedMemberCount : '\u2014'}
                </dd>
              </div>
              <div className="support-note-kv">
                <dt>{t('settings:schedules.coverage.schedules')}</dt>
                <dd>{schedules.length}</dd>
              </div>
              <div className="support-note-kv">
                <dt>{t('settings:schedules.coverage.locations')}</dt>
                <dd>{locations.length}</dd>
              </div>
              <div className="support-note-kv">
                <dt>{t('settings:schedules.coverage.assignments')}</dt>
                <dd>{assignments.length}</dd>
              </div>
            </dl>
          </section>

          {headsUp.length > 0 && (
            <section className="support-note" aria-labelledby="schedules-heads-up-title">
              <h3 className="support-note-title" id="schedules-heads-up-title">
                {t('settings:schedules.headsUp.title')}
              </h3>
              {headsUp.map((line) => (
                <p className="support-note-body" key={line}>
                  {line}
                </p>
              ))}
            </section>
          )}
        </aside>

        <section className="settings-card panel-aside-wide" aria-labelledby="assignments-section-title">
          <div className="card-header">
            <div className="card-header-text">
              <h3 id="assignments-section-title" className="card-title">
                {t('settings:schedules.sections.assignments')}
              </h3>
              <p className="card-description">{t('settings:schedules.assignment.cardDescription')}</p>
            </div>
            <div className="card-section-actions">
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
                {t('settings:schedules.actions.bulkAssignment')}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                data-testid="new-schedule-assignment"
                disabled={capabilityUnavailable || versionOptions.length === 0 || locations.length === 0}
                onClick={() => setAssignmentModalOpen(true)}
              >
                <PlusIcon size={16} /> {t('settings:schedules.actions.newAssignment')}
              </button>
            </div>
          </div>
          {/* Each row was four unlabelled spans, so every line restated its own label --
              "Effective from 3 Sep", "12 members affected" -- and nothing lined up between
              rows. The labels are column headers now; the cells carry only values. */}
          {assignments.length === 0 ? (
            <div className="dashboard-empty-state" data-testid="schedule-assignment-empty-state" role="status">
              <span aria-hidden="true">
                <CalendarIcon size={36} />
              </span>
              <p>{t('settings:schedules.empty.assignments')}</p>
            </div>
          ) : (
            <HorizontalScrollRegion
              labelledBy="assignments-section-title"
              describedById="schedule-assignments-scroll-hint"
              testId="schedule-assignment-list"
            >
              <table className="dashboard-table schedule-assignments-table">
                <thead>
                  <tr>
                    <th scope="col">{t('settings:schedules.assignment.columns.assignedTo')}</th>
                    <th scope="col">{t('settings:schedules.assignment.columns.schedule')}</th>
                    <th scope="col">{t('settings:schedules.assignment.columns.location')}</th>
                    <th scope="col">{t('settings:schedules.assignment.effectiveFrom')}</th>
                    <th scope="col" className="schedule-assignments-count">
                      {t('settings:schedules.assignment.columns.membersAffected')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.assignmentPublicId}>
                      <td dir="auto">{subjectLabel(assignment.scope, assignment.subjectPublicId)}</td>
                      <td dir="auto">{scheduleLabel(assignment.scheduleVersionPublicId)}</td>
                      <td dir="auto">{locationName(assignment.locationPublicId)}</td>
                      {/* L9: the date is formatted for the active locale rather than shown as a
                          raw ISO string (code review 2026-08-28). */}
                      <td>{formatEffectiveFrom(assignment.effectiveFrom, i18n.language)}</td>
                      <td className="schedule-assignments-count">{assignment.affectedMemberCount ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </HorizontalScrollRegion>
          )}
        </section>
      </div>

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
          groupsLoaded={overviewQuery.isSuccess}
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
  // Distinguishes "the organization has no Workforce Groups" from "the overview hasn't loaded".
  // Only the former is a dead end worth explaining.
  groupsLoaded: boolean
  onClose: () => void
  onSuccess: (message: string) => void
  onWarning?: (message: string) => void
}

function NewLocationContextModal({
  workforceGroups,
  groupsLoaded,
  onClose,
  onSuccess,
  onWarning,
}: NewLocationContextModalProps) {
  const { t } = useTranslation(['settings', 'common'])
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [ianaTimezone, setIanaTimezone] = useState('')
  const [holidayWorkforceGroupPublicId, setHolidayWorkforceGroupPublicId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // A location borrows its public holidays from a Workforce Group, and a tenant now starts with
  // none — the Organization Admin creates them. Without this the holiday source is an empty required
  // select above a permanently disabled button, with nothing saying why.
  const noGroups = groupsLoaded && workforceGroups.length === 0

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
            disabled={noGroups}
            aria-describedby={noGroups ? 'location-holiday-source-hint' : undefined}
          >
            <option value="">
              {noGroups
                ? t('settings:schedules.location.noGroups')
                : t('settings:schedules.location.selectHolidaySource')}
            </option>
            {workforceGroups.map((group) => (
              <option key={group.publicId} value={group.publicId}>
                {group.name}
              </option>
            ))}
          </select>
          {noGroups && (
            <div className="tm-no-groups" data-testid="location-no-groups-hint">
              <p className="form-hint" id="location-holiday-source-hint" role="status">
                {t('settings:schedules.location.noGroupsHint')}
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                data-testid="location-create-group-link"
                onClick={() => {
                  onClose()
                  navigate('/settings?category=working-calendars')
                }}
              >
                {t('settings:schedules.location.noGroupsAction')}
              </button>
            </div>
          )}
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
