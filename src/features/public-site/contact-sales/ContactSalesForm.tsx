import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PublicApiError, publicUuid, submitContactSales } from '../../../api/publicClient'
import ar from '../../../i18n/locales/ar/public.json'
import en from '../../../i18n/locales/en/public.json'
import { emitApprovedPublicEvent } from '../analyticsGateway'

export type ContactSalesFormProps = {
  locale?: 'en' | 'ar'
  initialIntendedCount?: number
}

type SuccessSummary = {
  companyName: string
  intendedCount: number
  leadId: string
}

type TurnstileApi = { reset: (container?: string | HTMLElement) => void }

function newIdempotencyKey(): string {
  return `contact-sales-${publicUuid()}`
}

/**
 * Turnstile tokens are single-use. Without an explicit reset the widget keeps handing back
 * the spent token, so every retry after a rejected verification failed identically while
 * the visitor's own entries were correct.
 */
function resetTurnstileWidget(): void {
  const turnstile = (window as unknown as { turnstile?: TurnstileApi }).turnstile
  try {
    turnstile?.reset()
  } catch {
    // A reset failure must not mask the original submission error.
  }
}

export function ContactSalesForm({
  locale = 'en',
  initialIntendedCount = 201,
}: ContactSalesFormProps) {
  const copy = locale === 'ar' ? ar.contactSales : en.contactSales
  const [followUpConsent, setFollowUpConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [intendedCount, setIntendedCount] = useState(Math.max(1, initialIntendedCount))
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<SuccessSummary | null>(null)
  const startedRef = useRef(false)
  const idempotencyKeyRef = useRef<string | null>(null)
  const successHeadingRef = useRef<HTMLHeadingElement>(null)
  const errorSummaryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (success) successHeadingRef.current?.focus()
  }, [success])

  // Move focus to the error summary the same way success moves it to the heading;
  // role="alert" announces the text but leaves keyboard users where they were.
  useEffect(() => {
    if (error) errorSummaryRef.current?.focus()
  }, [error])

  useEffect(() => {
    const queryCount = Number(new URLSearchParams(window.location.search).get('intendedCount'))
    if (Number.isInteger(queryCount) && queryCount >= 1) setIntendedCount(queryCount)
  }, [])

  function recordStarted() {
    if (startedRef.current) return
    startedRef.current = true
    void emitApprovedPublicEvent({
      eventName: 'contact_sales_started.v1',
      dimensions: { route: '/contact-sales', locale, formVersion: '1' },
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!followUpConsent || submitting) return
    recordStarted()
    setSubmitting(true)
    setError(null)
    const form = event.currentTarget
    const data = new FormData(form)
    const turnstileToken = import.meta.env.DEV
      ? 'test-token'
      : String(data.get('cf-turnstile-response') ?? '')
    const payload = {
      companyName: String(data.get('companyName') ?? ''),
      contactName: String(data.get('contactName') ?? ''),
      contactEmail: String(data.get('contactEmail') ?? ''),
      intendedCount: Number(data.get('intendedCount')),
      country: String(data.get('country') ?? ''),
      implementationContext: String(data.get('implementationContext') ?? ''),
      followUpConsent,
      turnstileToken,
    }
    idempotencyKeyRef.current ??= newIdempotencyKey()
    try {
      const result = await submitContactSales(payload, idempotencyKeyRef.current)
      if (result.workspaceCreated !== false) throw new Error('Unexpected workspace state')
      setSuccess({
        companyName: payload.companyName,
        intendedCount: payload.intendedCount,
        leadId: result.leadId,
      })
    } catch (requestError) {
      // Any failed attempt burns the Turnstile token, so the next submit needs a fresh
      // challenge regardless of which failure it was.
      resetTurnstileWidget()

      if (requestError instanceof PublicApiError && requestError.status === 409) {
        // The key was already used for a different payload — most often because an
        // earlier attempt was recorded but its response was lost and the visitor then
        // corrected a field. Retire the key so the corrected lead can still be recorded.
        idempotencyKeyRef.current = null
        setError(copy.conflictError)
      } else if (
        requestError instanceof PublicApiError &&
        (requestError.status === 429 || requestError.status === 503)
      ) {
        setError(copy.recoveryError)
      } else if (requestError instanceof PublicApiError && requestError.status === 400) {
        setError(copy.validationError)
      } else {
        setError(copy.networkError)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <section className="contact-sales-success" data-testid="contact-sales-success">
        <p className="public-eyebrow">{copy.successEyebrow}</p>
        <h2 ref={successHeadingRef} tabIndex={-1}>{copy.successTitle}</h2>
        <p data-testid="contact-sales-no-workspace"><strong>{copy.noWorkspace}</strong></p>
        <dl className="contact-sales-success__summary">
          <div>
            <dt>{copy.companyLabel}</dt>
            <dd dir="auto">{success.companyName}</dd>
          </div>
          <div>
            <dt>{copy.intendedCountLabel}</dt>
            <dd><bdi>{success.intendedCount}</bdi></dd>
          </div>
          <div>
            <dt>{copy.referenceLabel}</dt>
            <dd><bdi dir="ltr">{success.leadId}</bdi></dd>
          </div>
        </dl>
        <p>{copy.nextStep}</p>
      </section>
    )
  }

  return (
    <form
      className="contact-sales-form"
      noValidate={false}
      onSubmit={(event) => void submit(event)}
      onInput={recordStarted}
    >
      {error ? (
        <div className="contact-sales-error" role="alert" tabIndex={-1} ref={errorSummaryRef}>
          <h2>{copy.errorTitle}</h2>
          <p>{error}</p>
        </div>
      ) : null}

      <div className="contact-sales-form__grid">
        <div className="contact-sales-field">
          <label htmlFor="contact-sales-company">{copy.companyLabel}</label>
          <input
            id="contact-sales-company"
            data-testid="contact-sales-company"
            name="companyName"
            type="text"
            autoComplete="organization"
            maxLength={160}
            required
          />
        </div>
        <div className="contact-sales-field">
          <label htmlFor="contact-sales-contact-name">{copy.contactNameLabel}</label>
          <input
            id="contact-sales-contact-name"
            data-testid="contact-sales-contact-name"
            name="contactName"
            type="text"
            autoComplete="name"
            maxLength={120}
            required
          />
        </div>
        <div className="contact-sales-field">
          <label htmlFor="contact-sales-email">{copy.emailLabel}</label>
          <input
            id="contact-sales-email"
            data-testid="contact-sales-email"
            name="contactEmail"
            type="email"
            dir="ltr"
            autoComplete="email"
            maxLength={254}
            required
          />
        </div>
        <div className="contact-sales-field">
          <label htmlFor="contact-sales-intended-count">{copy.intendedCountLabel}</label>
          <input
            id="contact-sales-intended-count"
            data-testid="contact-sales-intended-count"
            name="intendedCount"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={intendedCount}
            onChange={(event) => setIntendedCount(Number(event.currentTarget.value))}
            required
          />
        </div>
        <div className="contact-sales-field">
          <label htmlFor="contact-sales-country">{copy.countryLabel}</label>
          <input
            id="contact-sales-country"
            data-testid="contact-sales-country"
            name="country"
            type="text"
            dir="ltr"
            autoComplete="country"
            pattern="[A-Za-z]{2}"
            maxLength={2}
            aria-describedby="contact-sales-country-help"
            required
          />
          <small id="contact-sales-country-help">{copy.countryHelp}</small>
        </div>
        <div className="contact-sales-field contact-sales-field--wide">
          <label htmlFor="contact-sales-context">{copy.contextLabel}</label>
          <textarea
            id="contact-sales-context"
            data-testid="contact-sales-context"
            name="implementationContext"
            rows={5}
            maxLength={2000}
            required
          />
        </div>
      </div>

      <aside className="contact-sales-assurance" aria-labelledby="contact-sales-assurance-title">
        <h2 id="contact-sales-assurance-title">{copy.assuranceTitle}</h2>
        <p>{copy.assuranceBody}</p>
      </aside>

      <div className="contact-sales-consent">
        <label>
          <input
            data-testid="contact-sales-follow-up-consent"
            name="followUpConsent"
            type="checkbox"
            checked={followUpConsent}
            aria-describedby="contact-sales-consent-detail"
            onChange={(event) => setFollowUpConsent(event.currentTarget.checked)}
          />
          <strong>{copy.consentTitle}</strong>
        </label>
        <small id="contact-sales-consent-detail">{copy.consentBody}</small>
      </div>

      <div
        className="cf-turnstile contact-sales-turnstile"
        data-sitekey={import.meta.env.VITE_PUBLIC_TURNSTILE_SITE_KEY ?? ''}
        data-action="contact-sales"
        data-theme="light"
      />

      <button
        className="btn btn-primary contact-sales-submit"
        data-testid="contact-sales-submit"
        type="submit"
        disabled={!followUpConsent || submitting}
      >
        {submitting ? copy.submitting : copy.submit}
      </button>
      <p className="contact-sales-submit-note">{copy.submitNote}</p>
    </form>
  )
}
