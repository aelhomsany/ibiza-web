import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ApiError,
  getCalendarPrivacy,
  previewCalendarPrivacy,
  publishCalendarPrivacy,
} from '../../api/client'
import type {
  CalendarPrivacyPreviewResponse,
  CalendarPrivacyRuleResponse,
  PrivacyField,
  ViewerRelationship,
} from '../../api/generated/types'
import { DateField } from '../../components/DateField'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/useToast'
import { isolate } from '../../i18n/bidi'
import './calendar-privacy.css'

/** Declaration order is D-14 precedence, strongest first. */
const RELATIONSHIPS: ViewerRelationship[] = [
  'SELF',
  'ACTIVE_OR_COMPLETED_APPROVER',
  'ORGANIZATION_ADMIN',
  'DIRECT_REPORT_MANAGER',
  'SAME_WORKFORCE_GROUP',
  'ORGANIZATION_PEER',
]

const FIELDS: PrivacyField[] = ['IDENTITY', 'LEAVE_TYPE', 'STATUS', 'REASON', 'REQUEST_CONTEXT']

type CalendarPrivacySettingsPageProps = {
  // A Settings category panel, mounted by SettingsPage — not a route. Embedded use passes the
  // parent's toast callbacks so one success/warning surface serves the whole page.
  onSuccess?: (message: string) => void
  onWarning?: (message: string) => void
}

/** Tomorrow in the browser's zone. The server re-checks against the ORGANIZATION's operational
 * timezone and rejects anything not strictly in the future, so this is a helpful default, never
 * the authority.
 *
 * Built from local date parts rather than `toISOString()`: that formats in UTC, so anywhere east
 * of it (this product's own region included) "tomorrow" rolls back to today for part of every
 * evening, prefilling a date the server then rejects on every publish. */
function tomorrow(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** One date rendering for the whole panel — the status line and the preview used to disagree. */
function formatDay(iso: string, locale: string): string {
  const parsed = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  }).format(parsed)
}

function toMatrix(rules: CalendarPrivacyRuleResponse[]): Record<string, PrivacyField[]> {
  const matrix: Record<string, PrivacyField[]> = {}
  for (const rule of rules) {
    if (rule.viewerRelationship) {
      matrix[rule.viewerRelationship] = [...(rule.allowedFields ?? [])] as PrivacyField[]
    }
  }
  return matrix
}

export function CalendarPrivacySettingsPage({
  onSuccess,
  onWarning,
}: CalendarPrivacySettingsPageProps) {
  const { t, i18n } = useTranslation(['settings', 'common'])
  const queryClient = useQueryClient()
  const localToast = useToast()
  const notifySuccess = onSuccess ?? ((message: string) => localToast.showToast(message, 'success'))
  const notifyWarning = onWarning ?? ((message: string) => localToast.showToast(message, 'warning'))

  const privacyQuery = useQuery({
    queryKey: ['calendar-privacy'],
    queryFn: getCalendarPrivacy,
    retry: false,
  })

  // Only preview and publish are capability-gated server-side; the read is not. This used to be
  // driven off `privacyQuery.error`, a `capability-unavailable` the GET cannot produce, and once
  // set it never cleared — so a denial seen once disabled the matrix for the rest of the session
  // even after a successful retry (code review 2026-08-29).
  const [capabilityUnavailable, setCapabilityUnavailable] = useState(false)

  const [effectiveFrom, setEffectiveFrom] = useState(tomorrow)
  const [matrix, setMatrix] = useState<Record<string, PrivacyField[]>>({})
  const [preview, setPreview] = useState<CalendarPrivacyPreviewResponse | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  // Owned in component state rather than read off a mutation: React Query's isPending stalls
  // under StrictMode's double-invoke and leaves the button stuck mid-publish.
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (privacyQuery.data) {
      setMatrix(toMatrix(privacyQuery.data.rules))
    }
  }, [privacyQuery.data])

  const version = privacyQuery.data
  const sentenceFor = (fields: PrivacyField[]) => {
    if (fields.length === 0) return t('settings:calendarPrivacy.previewSentenceNothing')
    const details = new Intl.ListFormat(i18n.language, { style: 'long', type: 'conjunction' })
      .format(fields.map((field) => t(`settings:calendarPrivacy.fields.${field}`)))
    return t('settings:calendarPrivacy.previewSentence', { details })
  }

  // Per-field tally across the six relationships, straight off the draft matrix. The point of the
  // rail is that the matrix is read row-wise (what can THIS viewer see?) while the consequence
  // people ask about is column-wise (who can see a reason note?) -- counting six checkboxes by eye
  // in a 30-cell grid is exactly the arithmetic this panel should not be asking for.
  const allowedCount = (field: PrivacyField) =>
    RELATIONSHIPS.filter((relationship) => (matrix[relationship] ?? []).includes(field)).length

  const toggle = (relationship: ViewerRelationship, field: PrivacyField) => {
    setMatrix((current) => {
      const allowed = current[relationship] ?? []
      const next = allowed.includes(field)
        ? allowed.filter((value) => value !== field)
        : [...allowed, field]
      return { ...current, [relationship]: next }
    })
    // Any edit invalidates a preview taken against the previous matrix; publishing against a
    // stale preview is exactly the drift the preview exists to prevent.
    setPreview(null)
  }

  const payload = () => ({
    effectiveFrom,
    rules: RELATIONSHIPS.map((relationship) => ({
      viewerRelationship: relationship,
      allowedFields: matrix[relationship] ?? [],
    })),
  })

  const reportFailure = (cause: unknown, fallbackKey: string) => {
    if (cause instanceof ApiError && cause.problem.code === 'capability-unavailable') {
      setCapabilityUnavailable(true)
      notifyWarning(t('settings:calendarPrivacy.capabilityUnavailable'))
      return
    }
    if (cause instanceof ApiError && cause.fieldViolations?.effectiveFrom?.length) {
      notifyWarning(cause.fieldViolations.effectiveFrom.join(' '))
      return
    }
    notifyWarning(t(fallbackKey))
  }

  async function handlePreview() {
    setBusy(true)
    try {
      setPreview(await previewCalendarPrivacy(payload()))
      setCapabilityUnavailable(false)
      setPreviewOpen(true)
    } catch (cause) {
      setPreview(null)
      reportFailure(cause, 'settings:calendarPrivacy.previewError')
    } finally {
      setBusy(false)
    }
  }

  async function handlePublish() {
    setBusy(true)
    try {
      await publishCalendarPrivacy(payload())
      setPreviewOpen(false)
      setPreview(null)
      notifySuccess(t('settings:calendarPrivacy.published'))
      await queryClient.invalidateQueries({ queryKey: ['calendar-privacy'] })
      // Every absence-bearing read is projected through this version, so they are all stale now.
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (cause) {
      reportFailure(cause, 'settings:calendarPrivacy.publishError')
    } finally {
      setBusy(false)
    }
  }

  if (privacyQuery.isError && !capabilityUnavailable) {
    return (
      <p className="form-hint" role="alert" data-testid="calendar-privacy-load-error">
        {t('settings:calendarPrivacy.loadError')}
      </p>
    )
  }

  const publishedVersion = version?.usingDefaults ? null : version?.versionNumber ?? null

  // Not a rail on this panel: the matrix's own min-content width is 645px against an 854px
  // region, so a 300px rail beside it is impossible, and a rail beside the short intro above
  // it leaves the reading column empty for the rail's whole height. The same notes run as a
  // band across the panel instead, between the intro and the thing they annotate.
  // No card of its own for the intro either: SettingsPage already renders this category's
  // title and subtitle above, and the one line left -- how to read a viewer who matches two
  // rows -- is a rule about the matrix, so it sits at the head of the matrix card.
  return (
    <div className="panel-stack" data-testid="calendar-privacy-settings">
      <aside className="support-band">
        {/* Moved out of the intro stack: it is the one rule the matrix cannot express, so it read
            as a fourth hint among three and was routinely missed. */}
        <section className="support-note" aria-labelledby="calendar-privacy-always-title">
          <h3 className="support-note-title" id="calendar-privacy-always-title">
            {t('settings:calendarPrivacy.rail.alwaysTitle')}
          </h3>
          <p className="support-note-body">{t('settings:calendarPrivacy.presenceAlways')}</p>
        </section>

        <section className="support-note" aria-labelledby="calendar-privacy-effect-title">
          <h3 className="support-note-title" id="calendar-privacy-effect-title">
            {t('settings:calendarPrivacy.rail.effectTitle')}
          </h3>
          <dl className="support-note-list">
            {FIELDS.map((field) => (
              <div className="support-note-kv" key={field}>
                <dt>{t(`settings:calendarPrivacy.fields.${field}`)}</dt>
                <dd data-testid={`privacy-effect-${field}`}>{allowedCount(field)}</dd>
              </div>
            ))}
          </dl>
          <p className="support-note-body support-note-footnote">
            {t('settings:calendarPrivacy.rail.effectHint', { total: RELATIONSHIPS.length })}
          </p>
        </section>

        <section className="support-note" aria-labelledby="calendar-privacy-versioning-title">
          <h3 className="support-note-title" id="calendar-privacy-versioning-title">
            {t('settings:calendarPrivacy.rail.versioningTitle')}
          </h3>
          <dl className="support-note-list">
            <div className="support-note-kv">
              <dt>{t('settings:calendarPrivacy.rail.current')}</dt>
              <dd className="support-note-kv-quiet" data-testid="privacy-version-current">
                {publishedVersion
                  ? t('settings:calendarPrivacy.rail.version', { number: publishedVersion })
                  : t('settings:calendarPrivacy.rail.defaults')}
              </dd>
            </div>
            <div className="support-note-kv">
              <dt>{t('settings:calendarPrivacy.rail.since')}</dt>
              <dd className="support-note-kv-quiet">
                {version?.effectiveFrom
                  ? isolate(formatDay(version.effectiveFrom, i18n.language))
                  : t('settings:calendarPrivacy.rail.notPublished')}
              </dd>
            </div>
            <div className="support-note-kv">
              <dt>{t('settings:calendarPrivacy.rail.creates')}</dt>
              {/* Not "version 2" as a figure of speech: publishing increments whatever is live, and
                  the defaults are version zero, so the first publish really does create version 1. */}
              <dd className="support-note-kv-quiet" data-testid="privacy-version-next">
                {t('settings:calendarPrivacy.rail.version', { number: (publishedVersion ?? 0) + 1 })}
              </dd>
            </div>
          </dl>
        </section>
      </aside>

      <section className="settings-card" data-testid="calendar-privacy-matrix-card">
        <div className="calendar-privacy-intro">
          {capabilityUnavailable && (
            <p className="form-hint" role="alert" data-testid="calendar-privacy-capability-unavailable">
              {t('settings:calendarPrivacy.capabilityUnavailable')}
            </p>
          )}

          <p className="form-hint">{t('settings:calendarPrivacy.precedence')}</p>
        </div>

        <div className="table-wrap calendar-privacy-matrix-wrap" tabIndex={0}>
          <table
            className="dashboard-table calendar-privacy-matrix"
            data-testid="calendar-privacy-matrix"
          >
            <caption className="sr-only">{t('settings:calendarPrivacy.title')}</caption>
            <thead>
              <tr>
                <td aria-hidden="true" />
                <th scope="colgroup" colSpan={FIELDS.length}>
                  {t('settings:calendarPrivacy.fieldsHeading')}
                </th>
              </tr>
              <tr>
                <th scope="col">{t('settings:calendarPrivacy.relationshipsHeading')}</th>
                {FIELDS.map((field) => (
                  <th scope="col" key={field}>
                    {t(`settings:calendarPrivacy.fields.${field}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RELATIONSHIPS.map((relationship) => (
                <tr key={relationship} data-testid={`calendar-privacy-row-${relationship}`}>
                  <th scope="row">{t(`settings:calendarPrivacy.relationships.${relationship}`)}</th>
                  {FIELDS.map((field) => {
                    const checked = (matrix[relationship] ?? []).includes(field)
                    const label = `${t(`settings:calendarPrivacy.relationships.${relationship}`)} — ${t(`settings:calendarPrivacy.fields.${field}`)}`
                    return (
                      <td key={field}>
                        {/* The label is the 44px target (UX-DR75); the box itself cannot be one. */}
                        <label className="calendar-privacy-cell">
                          <input
                            type="checkbox"
                            checked={checked}
                            aria-label={label}
                            data-testid={`calendar-privacy-${relationship}-${field}`}
                            disabled={capabilityUnavailable || privacyQuery.isPending}
                            onChange={() => toggle(relationship, field)}
                          />
                        </label>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="calendar-privacy-publish">
          <div className="calendar-privacy-publish-row">
            <div className="form-group">
              <label htmlFor="calendar-privacy-effective-from">
                {t('settings:calendarPrivacy.effectiveFrom')}
              </label>
              <DateField
                id="calendar-privacy-effective-from"
                value={effectiveFrom}
                min={tomorrow()}
                onChange={(value) => {
                  setEffectiveFrom(value)
                  setPreview(null)
                }}
              />
            </div>
            <button
              type="button"
              className="btn btn-outline"
              data-testid="calendar-privacy-preview"
              disabled={busy || capabilityUnavailable || privacyQuery.isPending}
              onClick={handlePreview}
            >
              {t('settings:calendarPrivacy.actions.preview')}
            </button>
          </div>
          <p className="form-hint">{t('settings:calendarPrivacy.effectiveFromHint')}</p>
        </div>

        {previewOpen && (
        <Modal
          onClose={() => setPreviewOpen(false)}
          labelledBy="calendar-privacy-preview-title"
          testId="calendar-privacy-preview-modal"
        >
          <h2 id="calendar-privacy-preview-title" className="modal-title">
            {t('settings:calendarPrivacy.previewTitle')}
          </h2>
          <p className="form-hint">
            {t('settings:calendarPrivacy.previewIntro', {
              date: isolate(formatDay(preview?.effectiveFrom ?? effectiveFrom, i18n.language)),
            })}
          </p>
          {preview === null ? (
            // The matrix was edited behind the open modal, so the list below described a matrix
            // that no longer exists. Say so rather than rendering an empty list; publish is
            // already disabled on the same condition.
            <p className="form-hint" role="status" data-testid="calendar-privacy-preview-stale">
              {t('settings:calendarPrivacy.previewStale')}
            </p>
          ) : null}
          <ul className="calendar-privacy-preview-list" data-testid="calendar-privacy-preview-list">
            {(preview?.rules ?? []).map((rule) => (
              <li key={rule.viewerRelationship}>
                <strong>
                  {t(`settings:calendarPrivacy.relationships.${rule.viewerRelationship}`)}
                </strong>
                {/* UX-DR74 / L15: a sentence, not a field list. Composed here rather than taken
                    from the response's English `summary`, which has no Arabic counterpart. */}
                <span className="calendar-privacy-preview-sentence">
                  {sentenceFor(rule.allowedFields ?? [])}
                </span>
              </li>
            ))}
          </ul>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPreviewOpen(false)}
            >
              {t('settings:calendarPrivacy.actions.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              data-testid="calendar-privacy-publish"
              // Publish is gated on a resolved preview: UX-DR74 requires HR to see what each
              // relationship gets before the change takes effect.
              disabled={busy || preview === null}
              onClick={handlePublish}
            >
              {t('settings:calendarPrivacy.actions.publish')}
            </button>
          </div>
        </Modal>
        )}
      </section>
    </div>
  )
}
