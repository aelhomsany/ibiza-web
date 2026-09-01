import { useEffect, useMemo, useState } from 'react'
import {
  loadPublicPlans,
  type PublicPlan,
  type PublicPlanCatalog,
  type PublicPlanCode,
} from '../../../api/publicClient'
import ar from '../../../i18n/locales/ar/public.json'
import en from '../../../i18n/locales/en/public.json'
import { emitApprovedPublicEvent } from '../analyticsGateway'
import {
  createPublicPlanIntent,
  intentQuery,
  preservePublicPlanIntent,
} from '../publicIntent'
import { isRegisterRouteAvailable } from '../publicRoutes'

export type PricingRecommendationProps = {
  locale?: 'en' | 'ar'
  registrationEnabled?: boolean
  initialIntendedCount?: number
}

const PUBLIC_PLAN_CODES = new Set<PublicPlanCode>(['FREE', 'GROWTH', 'CONTACT_SALES'])

function localePath(locale: 'en' | 'ar', route: string): string {
  return locale === 'ar' ? `/ar${route}` : route
}

function safePlans(catalog: PublicPlanCatalog | null): PublicPlan[] {
  if (!catalog) return []
  return catalog.plans
    .filter((plan) => PUBLIC_PLAN_CODES.has(plan.code))
    .sort((left, right) => left.minimumActiveUsers - right.minimumActiveUsers)
}

export function PricingRecommendation({
  locale = 'en',
  registrationEnabled,
  initialIntendedCount = 5,
}: PricingRecommendationProps) {
  const copy = locale === 'ar' ? ar.pricing : en.pricing
  const [countInput, setCountInput] = useState(String(Math.max(1, initialIntendedCount)))
  const [complexNeeds, setComplexNeeds] = useState(false)
  const [catalog, setCatalog] = useState<PublicPlanCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [fallbackPlan, setFallbackPlan] = useState<PublicPlanCode | null>(null)
  const count = Number(countInput)

  useEffect(() => {
    const queryCount = Number(new URLSearchParams(window.location.search).get('intendedCount'))
    if (Number.isInteger(queryCount) && queryCount >= 1) {
      setCountInput(String(queryCount))
    }
  }, [])

  const countIsValid = Number.isInteger(count) && count >= 1

  useEffect(() => {
    // An unusable count must clear the previous answer rather than leave a confident
    // recommendation standing against a blank or nonsensical field.
    if (!countIsValid) {
      setCatalog(null)
      setFallbackPlan(null)
      setLoading(false)
      setFailed(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setFailed(false)
    void loadPublicPlans(count, locale, complexNeeds, controller.signal)
      .then((next) => {
        setCatalog(next)
        setFallbackPlan(null)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setCatalog(null)
        setFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [complexNeeds, count, countIsValid, locale])

  const plans = useMemo(() => safePlans(catalog), [catalog])
  const recommended = catalog?.recommendedPlan ?? null
  // Show the catalog's localized plan name, never the raw enum code.
  const recommendedName =
    plans.find((plan) => plan.code === recommended)?.name ?? null
  const canRegister =
    (registrationEnabled ?? catalog?.registrationEnabled ?? false) && isRegisterRouteAvailable()
  const currentFallback = fallbackPlan ?? (!canRegister && recommended !== 'CONTACT_SALES' ? recommended : null)
  const fallbackIntent = currentFallback
    ? createPublicPlanIntent(currentFallback, count, locale)
    : null

  function recordSelection(plan: PublicPlanCode) {
    preservePublicPlanIntent(plan, count, locale)
    void emitApprovedPublicEvent({
      eventName: 'pricing_plan_selected.v1',
      dimensions: { route: '/pricing', locale, plan, interaction: 'cta' },
    })
  }

  function selectUnavailable(plan: PublicPlanCode) {
    recordSelection(plan)
    setFallbackPlan(plan)
  }

  return (
    <section className="pricing-experience" aria-labelledby="pricing-comparison-title">
      <div className="pricing-controls">
        <div>
          <label htmlFor="pricing-intended-count">{copy.countLabel}</label>
          <p id="pricing-count-help">{copy.countHelp}</p>
        </div>
        <input
          id="pricing-intended-count"
          data-testid="pricing-intended-count"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          aria-describedby="pricing-count-help"
          value={countInput}
          onChange={(event) => setCountInput(event.currentTarget.value)}
        />
        <label className="pricing-complex-choice">
          <input
            type="checkbox"
            checked={complexNeeds}
            onChange={(event) => setComplexNeeds(event.currentTarget.checked)}
          />
          <span>{copy.complexNeeds}</span>
        </label>
      </div>

      <div className="pricing-status" aria-live="polite">
        {loading ? <p>{copy.loading}</p> : null}
        {!countIsValid ? <p>{copy.countInvalid}</p> : null}
        {recommended && recommendedName ? (
          <p>
            {copy.recommendedLabel}{' '}
            <strong data-testid="pricing-recommended-plan" data-plan={recommended}>
              <bdi>{recommendedName}</bdi>
            </strong>
          </p>
        ) : null}
      </div>

      {!catalog && !failed && countIsValid ? (
        <div className="pricing-recovery" role="status">
          <p>{copy.loadingFallback}</p>
          <a className="btn btn-outline" href={localePath(locale, '/contact-sales')}>
            {copy.contactSales}
          </a>
        </div>
      ) : null}

      {failed ? (
        <div className="pricing-recovery" role="status">
          <h2>{copy.catalogUnavailableTitle}</h2>
          <p>{copy.catalogUnavailableBody}</p>
          <a className="btn btn-primary" href={localePath(locale, '/contact-sales')}>
            {copy.contactSales}
          </a>
        </div>
      ) : null}

      {plans.length > 0 ? (
        <div className="pricing-grid" aria-labelledby="pricing-comparison-title">
          <h2 id="pricing-comparison-title" className="sr-only">{copy.comparisonLabel}</h2>
          {plans.map((plan) => {
            const isRecommended = plan.code === recommended
            const availableCapabilities = plan.capabilities.filter(
              (capability) => capability.availability === 'AVAILABLE',
            )
            const nonAvailableCapabilities = plan.capabilities.filter(
              (capability) =>
                capability.availability === 'COMING_SOON' ||
                capability.availability === 'CONTACT_SALES',
            )
            const testId = `plan-card-${plan.code.toLowerCase().replace('_', '-')}`
            const ctaTestId = {
              FREE: 'cta-start-free',
              GROWTH: 'cta-choose-growth',
              CONTACT_SALES: 'cta-contact-sales',
            }[plan.code]
            const intent = createPublicPlanIntent(plan.code, count, locale)
            const contactHref = `${localePath(locale, '/contact-sales')}?${intentQuery(intent)}`
            const registerHref = `/register?${intentQuery(intent)}`

            return (
              <article
                className={`pricing-card${isRecommended ? ' pricing-card--recommended' : ''}`}
                data-testid={testId}
                data-recommended={String(isRecommended)}
                key={plan.code}
              >
                {isRecommended ? <p className="pricing-card__recommendation">{copy.recommended}</p> : null}
                <h3><bdi>{plan.name}</bdi></h3>
                <p className="pricing-card__band">{plan.userBand}</p>
                <p className="pricing-card__price"><bdi>{plan.priceBasis}</bdi></p>
                <p className="pricing-card__card">
                  {plan.cardRequired ? copy.cardRequired : copy.noCardRequired}
                </p>
                {/* AC1/L1: availability belongs inside the comparison unit, alongside
                    band, price, terms, and CTA — not only in the aside below the grid. */}
                <p
                  className="pricing-card__availability"
                  data-testid={`${testId}-availability`}
                  data-availability={plan.availability}
                >
                  {plan.availability === 'ASSISTED'
                    ? copy.availabilityAssisted
                    : canRegister
                      ? copy.availableNow
                      : copy.availabilityNotYetEnabled}
                </p>

                <h4>{copy.availableTitle}</h4>
                <ul className="pricing-card__capabilities">
                  {availableCapabilities.map((capability) => (
                    <li key={capability.code}>{capability.label}</li>
                  ))}
                </ul>
                {nonAvailableCapabilities.length > 0 ? (
                  <ul className="pricing-card__planned">
                    {nonAvailableCapabilities.map((capability) => (
                      <li key={capability.code}>
                        <strong>
                          {capability.availability === 'COMING_SOON'
                            ? copy.planned
                            : copy.assisted}
                        </strong>{' '}
                        {capability.label}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <h4>{copy.termsTitle}</h4>
                <ul className="pricing-card__terms">
                  {plan.materialTerms.map((term) => <li key={term}>{term}</li>)}
                </ul>

                {plan.code === 'CONTACT_SALES' ? (
                  <a
                    className="btn btn-outline pricing-card__cta"
                    data-testid={ctaTestId}
                    href={contactHref}
                    onClick={() => recordSelection(plan.code)}
                  >
                    {plan.ctaLabel}
                  </a>
                ) : canRegister ? (
                  <a
                    className="btn btn-primary pricing-card__cta"
                    data-testid={ctaTestId}
                    href={registerHref}
                    onClick={() => recordSelection(plan.code)}
                  >
                    {plan.ctaLabel}
                  </a>
                ) : (
                  <button
                    className="btn btn-primary pricing-card__cta"
                    data-testid={ctaTestId}
                    type="button"
                    onClick={() => selectUnavailable(plan.code)}
                  >
                    {plan.ctaLabel}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      ) : null}

      {fallbackIntent ? (
        <aside
          className="pricing-availability-fallback"
          data-testid="pricing-availability-fallback"
          data-plan={fallbackIntent.plan}
          data-intended-count={String(fallbackIntent.intendedCount)}
          data-locale={fallbackIntent.locale}
          aria-live="polite"
        >
          <h2>{copy.registrationUnavailableTitle}</h2>
          <p>{copy.registrationUnavailableBody}</p>
          <a
            className="btn btn-outline"
            href={`${localePath(locale, '/contact-sales')}?${intentQuery(fallbackIntent)}`}
          >
            {copy.contactSales}
          </a>
        </aside>
      ) : null}
    </section>
  )
}
