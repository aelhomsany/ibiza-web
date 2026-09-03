import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, createCalendarFeed, deleteCalendarFeed, getCalendarFeed } from '../../api/client'
import { Modal } from '../../components/ui/Modal'
import { CalendarIcon, CheckIcon, CloseIcon, RefreshCwIcon } from '../../components/ui/icons'
import './calendar-sync.css'
import './calendar-feed.css'
import './team-members.css'

type CalendarFeedSettingsProps = {
  onSuccess?: (message: string) => void
  onWarning?: (message: string) => void
}

type Confirm = 'rotate' | 'remove'

function mutationMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.problem.detail ?? fallback
  }
  return fallback
}

/**
 * Plan PUENTE B4. The URL exists in the browser only between a successful create and the next
 * render that drops it: the API never returns it again, so once the user leaves this card the
 * only way to get a working link is to rotate, which also kills the old one.
 */
export function CalendarFeedSettings({ onSuccess, onWarning }: CalendarFeedSettingsProps) {
  const { t, i18n } = useTranslation(['settings', 'common'])
  const queryClient = useQueryClient()
  const queryKey = ['calendar-feed', 'me'] as const
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [freshUrl, setFreshUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const urlInputRef = useRef<HTMLInputElement>(null)

  const statusQuery = useQuery({ queryKey, queryFn: getCalendarFeed })

  const createMutation = useMutation({
    mutationFn: createCalendarFeed,
    onSuccess: (response) => {
      const rotated = confirm === 'rotate'
      setConfirm(null)
      setCopied(false)
      setFreshUrl(response.url)
      void queryClient.invalidateQueries({ queryKey })
      onSuccess?.(t(rotated ? 'settings:calendarFeed.success.rotated' : 'settings:calendarFeed.success.created'))
    },
    onError: (error) => onWarning?.(mutationMessage(error, t('settings:calendarFeed.errors.create'))),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCalendarFeed,
    onSuccess: () => {
      setConfirm(null)
      setFreshUrl(null)
      void queryClient.invalidateQueries({ queryKey })
      onSuccess?.(t('settings:calendarFeed.success.removed'))
    },
    onError: (error) => onWarning?.(mutationMessage(error, t('settings:calendarFeed.errors.remove'))),
  })

  const copyUrl = async () => {
    if (!freshUrl) return
    try {
      await navigator.clipboard.writeText(freshUrl)
      setCopied(true)
      onSuccess?.(t('settings:calendarFeed.success.copied'))
    } catch {
      // No clipboard permission (or no clipboard at all): leave the text selected so a manual
      // copy is one keystroke away, and say so instead of pretending it worked.
      urlInputRef.current?.focus()
      urlInputRef.current?.select()
      onWarning?.(t('settings:calendarFeed.errors.copy'))
    }
  }

  const header = (
    <div className="card-section-header">
      <span className="card-section-title">{t('settings:calendarFeed.title')}</span>
    </div>
  )

  if (statusQuery.isPending) {
    return (
      <section className="settings-card settings-card-spaced" data-testid="calendar-feed-settings">
        {header}
        <p className="settings-card-loading-inline">{t('settings:calendarFeed.loading')}</p>
      </section>
    )
  }

  if (statusQuery.isError) {
    return (
      <section className="settings-card settings-card-spaced" data-testid="calendar-feed-settings">
        {header}
        <p className="settings-card-error-inline">{t('settings:calendarFeed.errors.load')}</p>
      </section>
    )
  }

  const status = statusQuery.data
  const busy = createMutation.isPending || deleteMutation.isPending
  const statusText = status.active
    ? t('settings:calendarFeed.active', {
        since: status.createdAt ? new Date(status.createdAt).toLocaleDateString(i18n.language) : '',
      })
    : t('settings:calendarFeed.notCreated')
  const fetchedText = status.active
    ? status.lastAccessedAt
      ? t('settings:calendarFeed.lastFetched', {
          when: new Date(status.lastAccessedAt).toLocaleString(i18n.language),
        })
      : t('settings:calendarFeed.neverFetched')
    : null

  return (
    <div className="panel-with-aside">
      <section className="settings-card settings-card-spaced" data-testid="calendar-feed-settings">
        {header}
        <div className="calendar-sync-body calendar-feed-body">
          <div className="calendar-sync-icon" aria-hidden="true">
            <CalendarIcon size={20} />
          </div>
          <div className="calendar-sync-copy">
            <p className="calendar-sync-title">{t('settings:calendarFeed.linkTitle')}</p>
            <p className="calendar-sync-status" data-testid="calendar-feed-status">
              {statusText}
              {fetchedText ? ` · ${fetchedText}` : ''}
            </p>
          </div>
          <div className="calendar-sync-actions">
            {!status.active && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => createMutation.mutate()}
                disabled={busy}
                data-busy={createMutation.isPending ? 'true' : undefined}
                data-testid="calendar-feed-create"
              >
                <CalendarIcon size={14} /> {t('settings:calendarFeed.actions.create')}
              </button>
            )}
            {status.active && (
              <>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setConfirm('rotate')}
                  disabled={busy}
                  data-testid="calendar-feed-rotate"
                >
                  <RefreshCwIcon size={14} /> {t('settings:calendarFeed.actions.rotate')}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setConfirm('remove')}
                  disabled={busy}
                  data-testid="calendar-feed-remove"
                >
                  <CloseIcon size={14} /> {t('settings:calendarFeed.actions.remove')}
                </button>
              </>
            )}
          </div>
        </div>

        {freshUrl && (
          <div className="calendar-feed-link" data-testid="calendar-feed-link">
            <p className="calendar-feed-link-copy">{t('settings:calendarFeed.shownOnce')}</p>
            <input
              ref={urlInputRef}
              className="calendar-feed-url"
              type="text"
              readOnly
              value={freshUrl}
              aria-label={t('settings:calendarFeed.urlLabel')}
              onFocus={(event) => event.currentTarget.select()}
              data-testid="calendar-feed-url"
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void copyUrl()}
              data-testid="calendar-feed-copy"
            >
              {copied ? <CheckIcon size={14} /> : null}{' '}
              {t(copied ? 'settings:calendarFeed.actions.copied' : 'settings:calendarFeed.actions.copy')}
            </button>
          </div>
        )}

        {confirm && (
          <Modal
            labelledBy="calendar-feed-confirm-title"
            onClose={() => setConfirm(null)}
            closeOnBackdrop={false}
            testId="calendar-feed-confirm-modal"
          >
            <div className="modal-header">
              <h2 className="modal-title" id="calendar-feed-confirm-title">
                {t(confirm === 'rotate' ? 'settings:calendarFeed.rotateTitle' : 'settings:calendarFeed.removeTitle')}
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setConfirm(null)}
                aria-label={t('common:actions.close')}
                disabled={busy}
              >
                <CloseIcon size={18} />
              </button>
            </div>
            <p className="calendar-sync-modal-copy">
              {t(confirm === 'rotate' ? 'settings:calendarFeed.rotateCopy' : 'settings:calendarFeed.removeCopy')}
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setConfirm(null)} disabled={busy}>
                {t('common:actions.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => (confirm === 'rotate' ? createMutation.mutate() : deleteMutation.mutate())}
                disabled={busy}
                data-busy={busy ? 'true' : undefined}
                data-testid="calendar-feed-confirm"
              >
                {t(
                  confirm === 'rotate'
                    ? 'settings:calendarFeed.actions.confirmRotate'
                    : 'settings:calendarFeed.actions.confirmRemove',
                )}
              </button>
            </div>
          </Modal>
        )}
      </section>

      <aside className="support-rail">
        {/* What the link exposes is the Team Calendar as this user sees it (D-6) — the rail says
            that in the user's terms, because "private URL" alone reads as "nobody can see it". */}
        <section className="support-note" aria-labelledby="calendar-feed-shows-title">
          <h3 className="support-note-title" id="calendar-feed-shows-title">
            {t('settings:calendarFeed.rail.showsTitle')}
          </h3>
          <ul className="support-note-bullets">
            <li>{t('settings:calendarFeed.rail.showsTeam')}</li>
            <li>{t('settings:calendarFeed.rail.showsHolidays')}</li>
            <li>{t('settings:calendarFeed.rail.showsWindow')}</li>
            <li>{t('settings:calendarFeed.rail.showsSecret')}</li>
          </ul>
        </section>

        <section className="support-note" aria-labelledby="calendar-feed-subscribe-title">
          <h3 className="support-note-title" id="calendar-feed-subscribe-title">
            {t('settings:calendarFeed.rail.subscribeTitle')}
          </h3>
          <ol className="calendar-feed-steps">
            <li>
              <strong>{t('settings:calendarFeed.rail.google')}</strong>{' '}
              {t('settings:calendarFeed.rail.googleSteps')}
            </li>
            <li>
              <strong>{t('settings:calendarFeed.rail.outlook')}</strong>{' '}
              {t('settings:calendarFeed.rail.outlookSteps')}
            </li>
            <li>
              <strong>{t('settings:calendarFeed.rail.apple')}</strong>{' '}
              {t('settings:calendarFeed.rail.appleSteps')}
            </li>
          </ol>
          <p className="support-note-body">{t('settings:calendarFeed.rail.refreshNote')}</p>
        </section>
      </aside>
    </div>
  )
}
