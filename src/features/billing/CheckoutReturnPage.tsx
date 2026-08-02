import { useEffect, useRef, useState } from 'react'
import { loadRegistration, type RegistrationState } from '../../api/publicClient'
import ar from '../../i18n/locales/ar/public.json'
import en from '../../i18n/locales/en/public.json'
import { emitApprovedPublicEvent } from '../public-site/analyticsGateway'

type Props = { locale: 'en' | 'ar' }

const TERMINAL = new Set<RegistrationState['status']>([
  'PAYMENT_CONFIRMED',
  'PROVISIONING_FAILED',
  'ACTION_REQUIRED',
  'ACTIVE',
])

/** Browser return parameters are hints only; this page renders state read from the server. */
export function CheckoutReturnPage({ locale }: Props) {
  const copy = (locale === 'ar' ? ar : en).registration.checkoutReturn
  const [registration, setRegistration] = useState<RegistrationState | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const eventSent = useRef(false)
  const query = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
  const registrationId = query.get('registrationId')
    ?? (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('ibiza.registrationId'))
  const plan = query.get('plan') === 'GROWTH' ? 'GROWTH' : 'STARTER'
  const outcome = query.get('outcome') === 'cancelled'
    ? 'cancelled'
    : query.get('outcome') === 'success' ? 'success' : 'unknown'

  useEffect(() => {
    if (eventSent.current) return
    eventSent.current = true
    void emitApprovedPublicEvent({
      eventName: 'checkout_return_viewed.v1',
      dimensions: {
        route: '/register/checkout-return', locale, plan, interaction: outcome, formVersion: '1',
      },
    })
  }, [locale, outcome, plan])

  useEffect(() => {
    if (!registrationId) {
      setUnavailable(true)
      return
    }
    let active = true
    let timer: number | undefined
    const refresh = async () => {
      try {
        const current = await loadRegistration(registrationId)
        if (!active) return
        setRegistration(current)
        setUnavailable(false)
        if (!TERMINAL.has(current.status)) timer = window.setTimeout(refresh, 2_000)
      } catch {
        if (active) setUnavailable(true)
      }
    }
    void refresh()
    return () => {
      active = false
      if (timer) window.clearTimeout(timer)
    }
  }, [registrationId])

  const continuePath = locale === 'ar' ? '/ar/register' : '/register'
  const recoveryPath = locale === 'ar' ? '/ar/register/recovery' : '/register/recovery'
  const status = registration?.status
  const action = status === 'PAYMENT_CONFIRMED' || status === 'PROVISIONING_FAILED'
    ? { href: continuePath, label: copy.completeWorkspace }
    : status === 'ACTION_REQUIRED'
      ? { href: continuePath, label: copy.resume }
      : unavailable
        ? { href: recoveryPath, label: copy.recover }
        : null

  return (
    <section className="registration-shell public-container" aria-labelledby="checkout-return-title">
      <div className="registration-card" data-testid="checkout-return-confirming">
        <p className="public-eyebrow">{copy.eyebrow}</p>
        <h1 id="checkout-return-title">{copy.title}</h1>
        <p aria-live="polite">
          {status === 'PAYMENT_CONFIRMED' ? copy.confirmed
            : status === 'PROVISIONING_FAILED' ? copy.provisioningFailed
              : status === 'ACTION_REQUIRED' ? copy.actionRequired
                : unavailable ? copy.unavailable : copy.waiting}
        </p>
        {registration ? (
          <p className="registration-plan">
            <bdi>{registration.selectedPlan}</bdi> · {registration.intendedCount}
          </p>
        ) : null}
        {action ? (
          <a className="btn btn-primary" data-testid="recovery-next-action" href={action.href}>
            {action.label}
          </a>
        ) : null}
        <p><a href={locale === 'ar' ? '/ar/' : '/'}>{copy.exit}</a></p>
      </div>
    </section>
  )
}
