import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ApiError,
  createChatWebhook,
  deleteChatWebhook,
  getChatWebhooks,
  testChatWebhook,
  updateChatWebhook,
} from '../../api/client'
import type { ChatWebhookResponse, ChatWebhookUpsertRequest } from '../../api/generated/types'
import { useAuth } from '../../auth/useAuth'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon, MessageSquareIcon, PlusIcon } from '../../components/ui/icons'
import './chat-notifications.css'
import './team-members.css'

type ChatNotificationsSettingsProps = {
  onSuccess?: (message: string) => void
  onWarning?: (message: string) => void
}

const QUERY_KEY = ['chat-webhooks'] as const

function mutationMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const problem = error.problem as { detail?: string; category?: string }
    if (problem.category) {
      return `${problem.detail ?? fallback} (${problem.category})`
    }
    return problem.detail ?? fallback
  }
  return fallback
}

/**
 * Plan PUENTE B5 — Settings → Integrations card for Slack / Teams incoming webhooks. HR Admin only
 * (D-5): the card renders nothing for anyone else rather than an empty shell. The webhook URL is
 * write-only — entered once, stored encrypted server-side, and only ever echoed back as its host.
 */
export function ChatNotificationsSettings({ onSuccess, onWarning }: ChatNotificationsSettingsProps) {
  const { t, i18n } = useTranslation(['settings', 'common'])
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<ChatWebhookResponse | 'new' | null>(null)
  const [removing, setRemoving] = useState<ChatWebhookResponse | null>(null)
  const isHrAdmin = user?.role === 'HR_ADMIN'

  const listQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getChatWebhooks,
    enabled: isHrAdmin,
  })

  const testMutation = useMutation({
    mutationFn: (id: number) => testChatWebhook(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      onSuccess?.(t('settings:chat.success.test'))
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      onWarning?.(mutationMessage(error, t('settings:chat.errors.test')))
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => deleteChatWebhook(id),
    onSuccess: () => {
      setRemoving(null)
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      onSuccess?.(t('settings:chat.success.removed'))
    },
    onError: (error) => onWarning?.(mutationMessage(error, t('settings:chat.errors.remove'))),
  })

  if (!isHrAdmin) {
    return null
  }

  const header = (
    <div className="card-section-header">
      <span className="card-section-title">{t('settings:chat.title')}</span>
    </div>
  )

  if (listQuery.isPending) {
    return (
      <section className="settings-card settings-card-spaced" data-testid="chat-notifications-settings">
        {header}
        <p className="settings-card-loading-inline">{t('settings:chat.loading')}</p>
      </section>
    )
  }

  if (listQuery.isError) {
    return (
      <section className="settings-card settings-card-spaced" data-testid="chat-notifications-settings">
        {header}
        <p className="settings-card-error-inline">{t('settings:chat.errors.load')}</p>
      </section>
    )
  }

  const webhooks = listQuery.data ?? []

  return (
    <div className="panel-with-aside">
      <section className="settings-card settings-card-spaced" data-testid="chat-notifications-settings">
        {header}
        <div className="chat-channels-body">
          <div className="chat-channels-intro">
            <p className="chat-channels-copy">
              {webhooks.length === 0 ? t('settings:chat.empty') : t('settings:chat.rail.postsPeerOnly')}
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setEditing('new')}
              data-testid="chat-webhook-add"
            >
              <PlusIcon size={14} /> {t('settings:chat.actions.add')}
            </button>
          </div>

          {webhooks.length > 0 && (
            <ul className="chat-channels-list" data-testid="chat-webhook-list">
              {webhooks.map((webhook) => {
                const hasError = webhook.status === 'ERROR'
                return (
                  <li key={webhook.id} className="chat-channel-row" data-testid={`chat-webhook-${webhook.id}`}>
                    <div className="chat-channel-icon" aria-hidden="true">
                      <MessageSquareIcon size={20} />
                    </div>
                    <div className="chat-channel-copy">
                      <p className="chat-channel-title" dir="auto">
                        {webhook.label}
                      </p>
                      <p className="chat-channel-meta">
                        <span>{t(`settings:chat.providers.${webhook.provider}`)}</span>
                        <span>·</span>
                        <span data-testid={`chat-webhook-host-${webhook.id}`}>{webhook.urlHost}</span>
                        <span>·</span>
                        <span
                          className={hasError ? 'chat-channel-status--error' : undefined}
                          data-testid={`chat-webhook-status-${webhook.id}`}
                        >
                          {t(`settings:chat.status.${webhook.status}`)}
                        </span>
                      </p>
                      <p className="chat-channel-meta">
                        <span>
                          {webhook.postDailyDigest
                            ? t('settings:chat.digestAt', { time: webhook.digestLocalTime })
                            : t('settings:chat.digestOff')}
                        </span>
                        {webhook.postApprovals && (
                          <>
                            <span>·</span>
                            <span>{t('settings:chat.approvalsOn')}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>
                          {webhook.lastPostedAt
                            ? t('settings:chat.lastPosted', {
                                when: new Date(webhook.lastPostedAt).toLocaleString(i18n.language),
                              })
                            : t('settings:chat.neverPosted')}
                        </span>
                      </p>
                      {hasError && (
                        <p className="chat-channel-warning">
                          {t('settings:chat.statusWarning', {
                            category: webhook.lastErrorCategory ?? t('common:unknown'),
                          })}
                        </p>
                      )}
                    </div>
                    <div className="chat-channel-actions">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => testMutation.mutate(webhook.id)}
                        disabled={testMutation.isPending}
                        data-busy={testMutation.isPending ? 'true' : undefined}
                        data-testid={`chat-webhook-test-${webhook.id}`}
                      >
                        {t('settings:chat.actions.test')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setEditing(webhook)}
                        data-testid={`chat-webhook-edit-${webhook.id}`}
                      >
                        {t('settings:chat.actions.edit')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setRemoving(webhook)}
                        data-testid={`chat-webhook-remove-${webhook.id}`}
                      >
                        {t('settings:chat.actions.remove')}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {editing !== null && (
          <ChatWebhookFormModal
            webhook={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={(created) => {
              setEditing(null)
              void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
              onSuccess?.(t(created ? 'settings:chat.success.created' : 'settings:chat.success.updated'))
            }}
          />
        )}

        {removing && (
          <Modal
            labelledBy="chat-webhook-remove-title"
            onClose={() => setRemoving(null)}
            closeOnBackdrop={false}
            testId="chat-webhook-remove-modal"
          >
            <div className="modal-header">
              <h2 className="modal-title" id="chat-webhook-remove-title">
                {t('settings:chat.removeTitle')}
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setRemoving(null)}
                aria-label={t('common:actions.close')}
                disabled={removeMutation.isPending}
              >
                <CloseIcon size={18} />
              </button>
            </div>
            <p className="chat-channel-modal-copy">
              {t('settings:chat.removeCopy', { label: removing.label })}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setRemoving(null)}
                disabled={removeMutation.isPending}
              >
                {t('common:actions.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => removeMutation.mutate(removing.id)}
                disabled={removeMutation.isPending}
                data-busy={removeMutation.isPending ? 'true' : undefined}
                data-testid="chat-webhook-confirm-remove"
              >
                {t('settings:chat.actions.confirmRemove')}
              </button>
            </div>
          </Modal>
        )}
      </section>

      <aside className="support-rail">
        <section className="support-note" aria-labelledby="chat-posts-title">
          <h3 className="support-note-title" id="chat-posts-title">
            {t('settings:chat.rail.postsTitle')}
          </h3>
          <ul className="support-note-bullets">
            <li>{t('settings:chat.rail.postsPeerOnly')}</li>
            <li>{t('settings:chat.rail.postsWfh')}</li>
            <li>{t('settings:chat.rail.postsSecret')}</li>
          </ul>
        </section>
        <section className="support-note" aria-labelledby="chat-digest-title">
          <h3 className="support-note-title" id="chat-digest-title">
            {t('settings:chat.rail.digestTitle')}
          </h3>
          <p className="support-note-body">{t('settings:chat.rail.digestCopy')}</p>
        </section>
      </aside>
    </div>
  )
}

type ChatWebhookFormModalProps = {
  webhook: ChatWebhookResponse | null
  onClose: () => void
  onSaved: (created: boolean) => void
}

function ChatWebhookFormModal({ webhook, onClose, onSaved }: ChatWebhookFormModalProps) {
  const { t } = useTranslation(['settings', 'common'])
  const isNew = webhook === null
  const [provider, setProvider] = useState<ChatWebhookResponse['provider']>(webhook?.provider ?? 'SLACK')
  const [label, setLabel] = useState(webhook?.label ?? '')
  const [url, setUrl] = useState('')
  const [postDailyDigest, setPostDailyDigest] = useState(webhook?.postDailyDigest ?? true)
  const [digestLocalTime, setDigestLocalTime] = useState(webhook?.digestLocalTime ?? '08:30')
  const [postApprovals, setPostApprovals] = useState(webhook?.postApprovals ?? false)
  const [labelError, setLabelError] = useState<string | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: (body: ChatWebhookUpsertRequest) =>
      isNew ? createChatWebhook(body) : updateChatWebhook(webhook.id, body),
    onSuccess: () => onSaved(isNew),
    onError: (error) => setServerError(mutationMessage(error, t('settings:chat.errors.save'))),
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerError(null)
    const trimmedLabel = label.trim()
    const trimmedUrl = url.trim()
    // SPA-only guard: the API rejects non-https and off-allowlist hosts authoritatively; this only
    // stops the obvious paste mistake (an http:// or a bare path) before a round trip.
    const nextLabelError = trimmedLabel ? null : t('settings:chat.form.errors.label')
    const urlRequired = isNew || trimmedUrl.length > 0
    const nextUrlError = urlRequired && !trimmedUrl.startsWith('https://') ? t('settings:chat.form.errors.https') : null
    setLabelError(nextLabelError)
    setUrlError(nextUrlError)
    if (nextLabelError || nextUrlError) {
      return
    }
    const body: ChatWebhookUpsertRequest = {
      label: trimmedLabel,
      postDailyDigest,
      digestLocalTime,
      postApprovals,
    }
    if (isNew) {
      body.provider = provider
    }
    if (trimmedUrl) {
      body.url = trimmedUrl
    }
    saveMutation.mutate(body)
  }

  return (
    <Modal
      labelledBy="chat-webhook-form-title"
      onClose={onClose}
      closeOnBackdrop={false}
      testId="chat-webhook-form-modal"
    >
      <div className="modal-header">
        <h2 className="modal-title" id="chat-webhook-form-title">
          {t(isNew ? 'settings:chat.form.addTitle' : 'settings:chat.form.editTitle')}
        </h2>
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label={t('common:actions.close')}
          disabled={saveMutation.isPending}
        >
          <CloseIcon size={18} />
        </button>
      </div>
      <form className="chat-channel-form" onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="chat-webhook-provider">{t('settings:chat.form.provider')}</label>
          <select
            id="chat-webhook-provider"
            value={provider}
            onChange={(event) => setProvider(event.target.value as ChatWebhookResponse['provider'])}
            disabled={!isNew}
          >
            <option value="SLACK">{t('settings:chat.providers.SLACK')}</option>
            <option value="TEAMS">{t('settings:chat.providers.TEAMS')}</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="chat-webhook-label">{t('settings:chat.form.label')}</label>
          <input
            id="chat-webhook-label"
            type="text"
            maxLength={80}
            value={label}
            placeholder={t('settings:chat.form.labelPlaceholder')}
            onChange={(event) => setLabel(event.target.value)}
            aria-invalid={labelError ? true : undefined}
            aria-describedby={labelError ? 'chat-webhook-label-error' : undefined}
          />
          {labelError && (
            <p className="field-error" id="chat-webhook-label-error" role="alert">
              {labelError}
            </p>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="chat-webhook-url">{t('settings:chat.form.url')}</label>
          <input
            id="chat-webhook-url"
            type="url"
            autoComplete="off"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            aria-invalid={urlError ? true : undefined}
            aria-describedby={urlError ? 'chat-webhook-url-error' : 'chat-webhook-url-hint'}
          />
          <p className="form-hint" id="chat-webhook-url-hint">
            {t(isNew ? 'settings:chat.form.urlHint' : 'settings:chat.form.urlKeepHint')}
          </p>
          {urlError && (
            <p className="field-error" id="chat-webhook-url-error" role="alert">
              {urlError}
            </p>
          )}
        </div>
        <div className="form-group">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={postDailyDigest}
              onChange={(event) => setPostDailyDigest(event.target.checked)}
            />
            {t('settings:chat.form.postDailyDigest')}
          </label>
        </div>
        <div className="form-group">
          <label htmlFor="chat-webhook-digest-time">{t('settings:chat.form.digestLocalTime')}</label>
          <input
            id="chat-webhook-digest-time"
            type="time"
            step={900}
            value={digestLocalTime}
            onChange={(event) => setDigestLocalTime(event.target.value)}
            disabled={!postDailyDigest}
          />
        </div>
        <div className="form-group">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={postApprovals}
              onChange={(event) => setPostApprovals(event.target.checked)}
            />
            {t('settings:chat.form.postApprovals')}
          </label>
        </div>
        {serverError && (
          <p className="chat-channel-form-error" role="alert" data-testid="chat-webhook-form-error">
            {serverError}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saveMutation.isPending}>
            {t('common:actions.cancel')}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saveMutation.isPending}
            data-busy={saveMutation.isPending ? 'true' : undefined}
            data-testid="chat-webhook-save"
          >
            {t(saveMutation.isPending ? 'common:actions.saving' : 'common:actions.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
