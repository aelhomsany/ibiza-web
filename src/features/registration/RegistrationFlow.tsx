import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  PublicApiError,
  loadRegistration,
  loadVisitorCountry,
  provisionRegistration,
  recoverRegistration,
  resendRegistration,
	startRegistration,
	startRegistrationCheckout,
  verifyRegistration,
  publicUuid,
  type RegistrationState,
} from '../../api/publicClient'
import { getBrowserTimezone } from '../../auth/timezone'
import ar from '../../i18n/locales/ar/public.json'
import en from '../../i18n/locales/en/public.json'
import { emitApprovedPublicEvent } from '../public-site/analyticsGateway'
import { countryOptions, inferCountryCode } from './countries'
import { useTurnstileWidget } from './useTurnstileWidget'

type RegistrationRoute = '/register' | '/register/verify' | '/register/recovery'
type Props = { locale: 'en' | 'ar'; route: RegistrationRoute }

/**
 * Destinations the public registration flow may hand to the customer app. Mirrors the server's
 * allowlist — the server re-validates, this just avoids sending something it will reject.
 */
function safeReturnPath(): string {
  const requested = new URLSearchParams(window.location.search).get('returnTo') ?? '/'
  return requested === '/' || requested === '/settings' || requested.startsWith('/settings?')
    || requested.startsWith('/settings#')
    ? requested
    : '/'
}

/**
 * Paid recovery quotes a short, stable reference so support can correlate the case without the
 * customer reading out an email address or a Stripe identifier. It is derived from the
 * registration capability the holder already possesses, so it discloses nothing new.
 */
function supportReference(registrationId: string): string {
  return `REG-${registrationId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)}`
}

/**
 * Registration states where money is already committed, the workspace is not yet usable, and the
 * customer is the one who has to act. `PAID_PROVISIONING` is deliberately absent: provisioning is
 * running server-side, so offering "Complete Workspace Setup" put a button on screen with nothing
 * to complete. That state gets a status line instead.
 */
const PAID_UNPROVISIONED = new Set<RegistrationState['status']>([
  'PAYMENT_CONFIRMED',
  'PROVISIONING_FAILED',
])

/** Replaces every occurrence — a template repeating a placeholder must substitute them all. */
/**
 * Active users each plan includes. The registration form states the ceiling rather than asking
 * for an estimate: Free discards the number server-side, and Growth reconciles the billed
 * quantity to the users actually activated, so nothing downstream depends on a guess made here.
 */
const PLAN_INCLUDED_USERS = { FREE: 5, GROWTH: 200 } as const

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{{${key}}}`).join(String(value)),
    template,
  )
}

export function RegistrationFlow({ locale, route }: Props) {
  const copy = locale === 'ar' ? ar.registration : en.registration
  const [state, setState] = useState<RegistrationState | null>(null)
	const [phase, setPhase] = useState<'start' | 'checking' | 'commitment' | 'provision' | 'recovery' | 'ready'>(
    route === '/register/verify' ? 'checking' : route === '/register/recovery' ? 'recovery' : 'start',
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recoveryAccepted, setRecoveryAccepted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const viewed = useRef(false)
  const verifyStarted = useRef(false)
  const startKey = useRef<string | null>(null)
  const resendKey = useRef<string | null>(null)
  const provisionKey = useRef<string | null>(null)
	const recoveryKey = useRef<string | null>(null)
	const checkoutKey = useRef<string | null>(null)
	const [selectedPlan, setSelectedPlan] = useState<'FREE' | 'GROWTH'>('FREE')
	const [intendedCount, setIntendedCount] = useState<number>(PLAN_INCLUDED_USERS.FREE)
	const [country, setCountry] = useState('EG')
	const countryTouched = useRef(false)
	const countries = useMemo(() => countryOptions(locale), [locale])
	const [planResolved, setPlanResolved] = useState(route !== '/register')

  // One widget per phase, each rendered explicitly when its phase is on screen.
  const { containerRef: startTurnstileRef, token: startToken, reset: resetStart } =
    useTurnstileWidget(phase === 'start')
  const { containerRef: resendTurnstileRef, token: resendToken, reset: resetResend } =
    useTurnstileWidget(phase === 'checking' && Boolean(state))
	const { containerRef: provisionTurnstileRef, token: provisionToken, reset: resetProvision } =
		useTurnstileWidget(phase === 'provision' && Boolean(state))
	const { containerRef: checkoutTurnstileRef, token: checkoutToken, reset: resetCheckout } =
		useTurnstileWidget(phase === 'commitment' && Boolean(state))

  useEffect(() => {
    if (route !== '/register' || !planResolved || viewed.current) return
    viewed.current = true
    void emitApprovedPublicEvent({
      eventName: 'registration_form_viewed.v1',
		dimensions: { route: '/register', locale, plan: selectedPlan, formVersion: '1' },
		})
	}, [locale, planResolved, route, selectedPlan])

  // Country resolution runs in two steps, strongest signal last.
  //
  // Prerendered markup cannot know where the reader is, so the local guess — time zone, then
  // declared languages — runs first, at hydration, and the field is never empty or wrong-looking
  // while the network is in flight. The edge's own answer then supersedes it if it arrives:
  // CF-IPCountry reflects the address the request actually came from, which a time zone only
  // approximates. A visitor who has already picked a country keeps their pick; a failed or absent
  // lookup simply leaves the local guess standing, which is why nothing here surfaces an error.
  useEffect(() => {
    setCountry((current) => inferCountryCode(current))

    const controller = new AbortController()
    void loadVisitorCountry(controller.signal)
      .then((resolved) => {
        if (controller.signal.aborted || !resolved) return
        setCountry((current) => (countryTouched.current ? current : resolved))
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (seconds <= 0) return
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1_000)
    return () => window.clearInterval(timer)
  }, [seconds])

  useEffect(() => {
    if (route !== '/register') return
	const queryPlan = new URLSearchParams(window.location.search).get('plan')
	// Growth is the only paid plan. A stale ?plan=STARTER link — a bookmark, an old
	// email — falls through to Free rather than erroring on a retired code.
	const plan = queryPlan === 'GROWTH' ? queryPlan : 'FREE'
	setSelectedPlan(plan)
		// An `?intendedCount=` on the link is no longer read here. The number is the plan's own
		// ceiling, so an entry link cannot land a Growth visitor on Free's 5 — which is what the
		// Pricing CTA used to carry.
		setIntendedCount(PLAN_INCLUDED_USERS[plan])
		setPlanResolved(true)
	}, [route])

  useEffect(() => {
    if (route !== '/register/verify') return
    // Guarded against a second invocation. StrictMode mounts, unmounts and remounts effects in
    // development, and any remount (Suspense retry, error-boundary reset) does the same in
    // production — without this the single-use token is consumed twice and the second attempt
    // reports the link as expired, hiding a perfectly successful verification.
    if (verifyStarted.current) return
    verifyStarted.current = true

    const query = new URLSearchParams(window.location.search)
    const registrationId = query.get('registrationId') ?? ''
    const token = query.get('token') ?? ''
    window.history.replaceState({}, '', locale === 'ar' ? '/ar/register/verify' : '/register/verify')

    if (!registrationId || !token) {
      // Reached by refreshing after a successful verification: replaceState has already stripped
      // the credentials, so their absence means "already used", not "expired". Resume from the
      // stored id instead of dumping a verified administrator into recovery.
      const resumed = sessionStorage.getItem('ibiza.registrationId')
      if (resumed) {
        void loadRegistration(resumed)
          .then((current) => {
            setState(current)
            setSeconds(current.resendAvailableInSeconds)
				setPhase(current.status === 'VERIFIED'
					? current.selectedPlan === 'FREE' ? 'provision' : 'commitment'
					: current.status === 'PAYMENT_CONFIRMED' || current.status === 'PROVISIONING_FAILED' ? 'provision'
					: current.workspaceCreated ? 'ready' : 'checking')
          })
          .catch(() => {
            setError(copy.expired)
            setPhase('recovery')
          })
        return
      }
      setError(copy.expired)
      setPhase('recovery')
      return
    }

    sessionStorage.setItem('ibiza.registrationId', registrationId)
    void verifyRegistration(registrationId, token)
      .then((next) => {
        setState(next)
		setPhase(next.selectedPlan === 'FREE' ? 'provision' : 'commitment')
      })
      .catch(() => {
        setError(copy.expired)
        setPhase('recovery')
      })
  }, [copy.expired, locale, route])

  // The recovery route stays non-enumerating: an unreadable or unknown id silently falls back to
  // the neutral email form rather than confirming or denying that a registration exists.
  useEffect(() => {
    if (route !== '/register/recovery') return
    const requested = new URLSearchParams(window.location.search).get('registrationId')
      ?? sessionStorage.getItem('ibiza.registrationId')
    if (!requested) return
    void loadRegistration(requested)
      .then((current) => {
        setState(current)
        // The next action on this page links to /register, which resumes from sessionStorage
        // only. Without this a customer arriving by recovery link dropped into an empty start
        // form. Written after the load succeeds, so an unknown id is never persisted.
        sessionStorage.setItem('ibiza.registrationId', current.registrationId)
      })
      .catch(() => undefined)
  }, [route])

  useEffect(() => {
    if (route !== '/register') return
    const registrationId = sessionStorage.getItem('ibiza.registrationId')
    if (!registrationId) return
    void loadRegistration(registrationId)
      .then((current) => {
        setState(current)
        setSeconds(current.resendAvailableInSeconds)
		setPhase(current.status === 'VERIFIED'
			? current.selectedPlan === 'FREE' ? 'provision' : 'commitment'
			: current.status === 'PAYMENT_CONFIRMED' || current.status === 'PROVISIONING_FAILED' ? 'provision'
			: current.workspaceCreated ? 'ready' : 'checking')
      })
      .catch(() => sessionStorage.removeItem('ibiza.registrationId'))
  }, [route])

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const data = new FormData(event.currentTarget)
    setSubmitting(true)
    setError(null)
    try {
      startKey.current ??= publicUuid()
      const next = await startRegistration({
		selectedPlan,
        intendedCount: Number(data.get('intendedCount')),
        administratorEmail: String(data.get('administratorEmail')),
        organizationName: String(data.get('organizationName')),
        locale,
        country: String(data.get('country')).toUpperCase(),
        timezone: getBrowserTimezone(),
        safeReturnPath: safeReturnPath(),
        termsVersion: '2026-07-31',
        privacyVersion: '2026-07-31',
        turnstileToken: startToken(),
      }, startKey.current)
      sessionStorage.setItem('ibiza.registrationId', next.registrationId)
      setState(next)
      setSeconds(next.resendAvailableInSeconds)
      setPhase('checking')
    } catch (requestError) {
      resetStart()
      if (requestError instanceof PublicApiError && requestError.status === 409) startKey.current = null
      setError(requestError instanceof PublicApiError && requestError.status === 403 ? copy.disabled : copy.error)
    } finally {
      setSubmitting(false)
		}
	}

	async function checkout() {
		if (!state || state.selectedPlan === 'FREE' || submitting) return
		setSubmitting(true)
		setError(null)
		try {
			// A fresh key per attempt, not a value derived from the commitment. The derived key was
			// identical on every mount, so a customer returning after expiry replayed a key the
			// server had already consumed: it bumped the attempt, minted a session, then rolled back
			// on uk_registration_operation_key and answered 409. Only the second click worked.
			// Reusing a key across a reload buys nothing either — while a session is still live the
			// server returns the stored URL before it ever reads the idempotency table, and the key
			// only decides anything when a *new* session is being minted, which is exactly when it
			// must be new. Within one mount the key is stable, which is what stops a double-submit.
			checkoutKey.current ??= publicUuid()
			const result = await startRegistrationCheckout(
				state.registrationId, state.selectedPlan, state.intendedCount,
				checkoutToken(), checkoutKey.current,
			)
			window.location.assign(result.checkoutUrl)
		} catch (requestError) {
			resetCheckout()
			if (requestError instanceof PublicApiError && requestError.status === 409) {
				checkoutKey.current = null
			}
			setError(requestError instanceof PublicApiError && requestError.status === 503
				? copy.paid.checkoutUnavailable : copy.error)
		} finally {
			setSubmitting(false)
		}
	}

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!state || seconds > 0 || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      resendKey.current ??= publicUuid()
      const next = await resendRegistration(state.registrationId, resendToken(), resendKey.current)
      setState(next)
      setSeconds(next.resendAvailableInSeconds)
      resendKey.current = null
    } catch (requestError) {
      resetResend()
      if (requestError instanceof PublicApiError && requestError.status === 409) resendKey.current = null
      setError(copy.error)
    } finally {
      setSubmitting(false)
    }
  }

  async function provision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!state || submitting) return
    const data = new FormData(event.currentTarget)
    setSubmitting(true)
    setError(null)
    try {
      provisionKey.current ??= publicUuid()
      const result = await provisionRegistration(state.registrationId, {
        organizationDisplayName: state.organizationName,
        country: state.country,
        timezone: state.timezone,
        administratorFullName: String(data.get('administratorFullName')),
        administratorPassword: String(data.get('administratorPassword')),
        turnstileToken: provisionToken(),
      }, provisionKey.current)
      setPhase('ready')
      sessionStorage.removeItem('ibiza.registrationId')
      window.location.replace(result.handoffPath)
    } catch (requestError) {
      resetProvision()
      // Mirrors `start`. A lost response (backgrounded tab, dropped connection, request timeout)
      // leaves the key bound to the first fingerprint, so retyping the name or password produces
      // a different fingerprint and every retry 409s forever — with the workspace already created
      // and unreachable from this screen. Regenerating the key lets the retry converge instead.
      if (requestError instanceof PublicApiError && requestError.status === 409) {
        provisionKey.current = null
        setError(copy.retry ?? copy.error)
      } else {
        setError(requestError instanceof PublicApiError && requestError.status === 403
          ? copy.disabled
          : copy.error)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const data = new FormData(event.currentTarget)
    setSubmitting(true)
    setError(null)
    try {
      recoveryKey.current ??= publicUuid()
      await recoverRegistration(String(data.get('administratorEmail')), recoveryKey.current)
      setRecoveryAccepted(true)
    } catch {
      // The recovery surface stays deliberately neutral, including provider failures.
      setRecoveryAccepted(true)
    } finally {
      setSubmitting(false)
    }
  }

  /** Plan + declared quantity, shown on every step so the commitment never leaves the screen. */
  const planSummary = (testId?: string) => (
    <p className="registration-plan" {...(testId ? { 'data-testid': testId } : {})}>
		{(state?.selectedPlan ?? selectedPlan) === 'FREE'
			? copy.planSummary
			: interpolate(copy.paid.planSummary, {
				plan: state?.selectedPlan ?? selectedPlan,
				// Deferred: this belongs in the catalog response the pricing page already reads.
				price: 1,
			})}
      {' · '}
      <span data-testid="register-plan-quantity">
        {interpolate(copy.countSummary ?? '{{count}}', { count: state?.intendedCount ?? intendedCount })}
      </span>
    </p>
  )

  return (
    <section className="registration-shell public-container" aria-labelledby="registration-title">
      <div className="registration-card">
        <p className="public-eyebrow">{copy.eyebrow}</p>
        <h1 id="registration-title">
		  {phase === 'provision' ? copy.provisionTitle
			: phase === 'commitment' ? copy.paid.commitmentTitle
				: phase === 'recovery' ? copy.recoveryTitle
					: selectedPlan === 'FREE' ? copy.title : copy.paid.title}
        </h1>
        {error ? <div className="registration-error" role="alert">{error}</div> : null}

        {phase === 'start' ? (
          <form onSubmit={(event) => void start(event)}>
			<p className="public-lede">{selectedPlan === 'FREE' ? copy.intro : copy.paid.intro}</p>
            {planSummary('register-plan-summary')}
            {/* Read-only on both plans: the field reports what the chosen plan includes rather
                than asking for an estimate, so it is shown filled and dimmed. */}
            <label>
              {copy.count}
              <input
                data-testid="register-intended-count"
                name="intendedCount"
                type="number"
                min={1}
                max={PLAN_INCLUDED_USERS[selectedPlan]}
                value={intendedCount}
                readOnly
                aria-describedby="register-count-note"
                required
              />
              <small id="register-count-note">
                {interpolate(copy.countPlanNote, { count: PLAN_INCLUDED_USERS[selectedPlan] })}
              </small>
            </label>
            <label>{copy.email}<input data-testid="register-email" name="administratorEmail" type="email" dir="ltr" autoComplete="email" required /></label>
            <label>{copy.organization}<input data-testid="register-org-name" name="organizationName" autoComplete="organization" maxLength={160} required /></label>
            <label>
              {copy.country}
              <select
                data-testid="register-country"
                name="country"
                autoComplete="country"
                value={country}
                onChange={(event) => {
                  countryTouched.current = true
                  setCountry(event.target.value)
                }}
                required
              >
                {countries.map((option) => (
                  <option key={option.code} value={option.code}>{option.name}</option>
                ))}
              </select>
            </label>
            <div ref={startTurnstileRef} data-action="registration" />
            <p className="registration-terms">{copy.terms}</p>
            <button className="btn btn-primary" data-testid="register-submit" disabled={submitting}>{submitting ? copy.working : copy.start}</button>
          </form>
        ) : null}

        {phase === 'checking' && state ? (
          <div aria-live="polite">
            <h2>{copy.checkEmail}</h2>
            {planSummary()}
            {/* The masked address is an LTR identifier inside RTL copy — without isolation the
                bidi algorithm reorders it and Arabic readers see a mangled address. */}
            <p data-testid="verification-masked-email">
              {copy.checkEmailBody.split('{{email}}').flatMap((segment, index) => (
                index === 0
                  ? [segment]
                  : [<bdi key={index} dir="ltr">{state.maskedEmail}</bdi>, segment]
              ))}
            </p>
            <form onSubmit={(event) => void resend(event)}>
              <div ref={resendTurnstileRef} data-action="registration" />
              <button className="btn btn-outline" data-testid="verification-resend" disabled={submitting || seconds > 0}>
                {seconds > 0 ? interpolate(copy.resendWait, { seconds }) : copy.resend}
              </button>
            </form>
            <p><a href={locale === 'ar' ? '/ar/register/recovery' : '/register/recovery'}>{copy.recoveryTitle}</a></p>
          </div>
        ) : null}

		{phase === 'checking' && !state ? <p aria-live="polite">{copy.verifying}</p> : null}

		{phase === 'commitment' && state && state.selectedPlan !== 'FREE' ? (
		  <div data-testid="paid-commitment-review">
			{planSummary('register-plan-summary')}
			<p>{copy.paid.priceBasis}</p>
			<ul className="registration-commitment-terms">
			  <li>{copy.paid.billingTiming}</li>
			  <li>{copy.paid.renewal}</li>
			  <li>{copy.paid.cancellation}</li>
			  <li>{copy.paid.downgrade}</li>
			  <li>{copy.paid.availability}</li>
			</ul>
			<div ref={checkoutTurnstileRef} data-action="registration" />
			<button type="button" className="btn btn-primary" data-testid="checkout-start" disabled={submitting} onClick={() => void checkout()}>
			  {submitting ? copy.working : copy.paid.checkout}
			</button>
		  </div>
		) : null}

        {phase === 'provision' && state ? (
          <form onSubmit={(event) => void provision(event)}>
            {planSummary()}
            <label>{copy.fullName}<input name="administratorFullName" autoComplete="name" maxLength={120} required /></label>
            <label>{copy.password}<input name="administratorPassword" type="password" dir="ltr" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
            <div ref={provisionTurnstileRef} data-action="registration" />
            <button className="btn btn-primary" data-testid="provision-submit" disabled={submitting}>
              {submitting ? copy.working : state.selectedPlan === 'FREE' ? copy.provision : copy.paid.provision}
            </button>
          </form>
        ) : null}

        {/* Money is already committed here, so the only offered action completes the workspace —
            never a second Checkout. */}
        {phase === 'recovery' && state && state.selectedPlan !== 'FREE'
          && PAID_UNPROVISIONED.has(state.status) ? (
          <div data-testid="paid-unprovisioned-recovery">
            {planSummary()}
            <p>{copy.paid.recoveryBody}</p>
            <p>
              {copy.paid.supportReferenceLabel}
              {': '}
              <bdi dir="ltr" data-testid="support-reference">{supportReference(state.registrationId)}</bdi>
            </p>
            <a
              className="btn btn-primary"
              data-testid="recovery-next-action"
              href={locale === 'ar' ? '/ar/register' : '/register'}
            >
              {copy.paid.recoveryAction}
            </a>
          </div>
        ) : phase === 'recovery' && state && state.selectedPlan !== 'FREE'
          && state.status === 'PAID_PROVISIONING' ? (
          /* Provisioning is running server-side. There is nothing for the customer to complete,
             so this states the fact instead of offering a button with no work behind it. */
          <div data-testid="paid-provisioning-status" role="status">
            {planSummary()}
            <p>{copy.paid.provisioningRunning}</p>
            <p>
              {copy.paid.supportReferenceLabel}
              {': '}
              <bdi dir="ltr" data-testid="support-reference">{supportReference(state.registrationId)}</bdi>
            </p>
          </div>
        ) : phase === 'recovery' ? recoveryAccepted ? (
          <p data-testid="registration-recovery" role="status">{copy.recoveryAccepted}</p>
        ) : (
          <form onSubmit={(event) => void recover(event)} data-testid="registration-expired-recovery">
            <p>{copy.recoveryBody}</p>
            <label>{copy.email}<input name="administratorEmail" type="email" dir="ltr" autoComplete="email" required /></label>
            <button className="btn btn-primary" data-testid="registration-recovery" disabled={submitting}>{submitting ? copy.working : copy.recover}</button>
          </form>
        ) : null}

        {phase === 'ready' ? (
          <p data-testid="handoff-status" role="status">
            {state?.selectedPlan === 'FREE' ? copy.ready : copy.paid.ready}
          </p>
        ) : null}
      </div>
    </section>
  )
}
