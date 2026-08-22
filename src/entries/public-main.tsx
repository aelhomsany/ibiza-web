import { createRoot, hydrateRoot } from 'react-dom/client'
import '../styles/tokens.css'
import '../styles/global.css'
import '../features/public-site/public-site.css'
import { resolvePublicRoute } from '../features/public-site/publicRoutes'
import {
  emitApprovedPublicEvent,
  startConsentedPageView,
} from '../features/public-site/analyticsGateway'
import { ConsentPreference } from '../features/public-site/consent/ConsentPreference'
import { PricingRecommendation } from '../features/public-site/pricing/PricingRecommendation'
import { ContactSalesForm } from '../features/public-site/contact-sales/ContactSalesForm'
import {
  getStoredConsent,
  type StoredConsentPreference,
} from '../features/public-site/consent/publicConsent'
import { PublicApp } from '../apps/public/PublicApp'
import { RegistrationFlow } from '../features/registration/RegistrationFlow'
import { CheckoutReturnPage } from '../features/billing/CheckoutReturnPage'

const resolved = resolvePublicRoute(window.location.pathname)
document.documentElement.lang = resolved.locale
document.documentElement.dir = resolved.locale === 'ar' ? 'rtl' : 'ltr'

const publicDocument = document.getElementById('public-document')
const hasStaticDocument = Boolean(publicDocument?.firstElementChild)
if (publicDocument && !hasStaticDocument) {
  createRoot(publicDocument).render(<PublicApp pathname={window.location.pathname} />)
}

const skipLink = document.querySelector<HTMLAnchorElement>('a[href="#public-main"]')
const publicMain = document.getElementById('public-main')
skipLink?.addEventListener('click', (event) => {
  if (!publicMain) return
  event.preventDefault()
  publicMain.focus({ preventScroll: true })
  publicMain.scrollIntoView({ block: 'start' })
})

const consentRoot = document.getElementById('privacy-choices')
if (hasStaticDocument && consentRoot) {
  hydrateRoot(
    consentRoot,
    <ConsentPreference locale={resolved.locale} hydrateSafe />,
  )
}

const pricingRoot = document.getElementById('pricing-island')
if (hasStaticDocument && pricingRoot) {
  hydrateRoot(pricingRoot, <PricingRecommendation locale={resolved.locale} />)
}

const contactSalesRoot = document.getElementById('contact-sales-island')
if (hasStaticDocument && contactSalesRoot) {
  hydrateRoot(contactSalesRoot, <ContactSalesForm locale={resolved.locale} />)
}
const registrationRoot = document.getElementById('registration-island')
if (hasStaticDocument && registrationRoot && resolved.route.startsWith('/register')) {
  hydrateRoot(
    registrationRoot,
    <RegistrationFlow
      locale={resolved.locale}
      route={resolved.route as '/register' | '/register/verify' | '/register/recovery'}
    />,
  )
}
const checkoutReturnRoot = document.getElementById('checkout-return-island')
if (hasStaticDocument && checkoutReturnRoot && resolved.route === '/register/checkout-return') {
  hydrateRoot(checkoutReturnRoot, <CheckoutReturnPage locale={resolved.locale} />)
}
if (
  (resolved.route === '/contact-sales' || resolved.route.startsWith('/register')) &&
  !import.meta.env.DEV &&
  import.meta.env.VITE_PUBLIC_TURNSTILE_SITE_KEY
) {
  // Explicit rendering, not the implicit one-shot scan. The implicit mode scans for
  // `.cf-turnstile` once when the script loads, which only ever finds widgets already in the
  // DOM — on the registration flow that is the start-step widget alone. The resend and
  // provision widgets mount on later phases and would never initialize, so their token would
  // always be empty and every submit would fail server-side validation.
  const script = document.createElement('script')
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  script.async = true
  script.defer = true
  document.head.append(script)
}

function safeAttribution(value: string | null, fallback: string): string {
  if (!value) return fallback
  const normalized = value.trim().slice(0, 80)
  return /^[a-zA-Z0-9._~-]+$/.test(normalized) ? normalized : fallback
}

let analyticsStarted = false

function startConsentedAnalytics(preference?: StoredConsentPreference) {
  const effectivePreference = preference ?? getStoredConsent() ?? undefined
  if (
    analyticsStarted ||
    resolved.route === '/404' ||
    import.meta.env.VITE_PUBLIC_ANALYTICS_ENABLED === 'false' ||
    effectivePreference?.analytics !== 'ACCEPTED'
  ) {
    return
  }
  analyticsStarted = true
  const params = new URLSearchParams(window.location.search)
  const route = resolved.route
  void startConsentedPageView({
    eventName: 'public_page_viewed.v2',
    dimensions: {
      route,
      locale: resolved.locale,
      source: safeAttribution(params.get('utm_source'), 'direct'),
      campaign: safeAttribution(params.get('utm_campaign'), 'none'),
    },
  })

  const proof = document.querySelector<HTMLElement>('[data-proof-type]')
  if (!proof) return
  const proofType =
    proof.dataset.proofType === 'distributed-team'
      ? 'distributed-team'
      : 'working-day'
  if (!('IntersectionObserver' in window)) return
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
        return
      }
      observer.disconnect()
      void emitApprovedPublicEvent({
        eventName: 'product_proof_viewed.v1',
        dimensions: {
          proofType,
          route,
          locale: resolved.locale,
        },
      })
    },
    { threshold: [0.5] },
  )
  observer.observe(proof)
}

window.addEventListener('ibiza:public-consent', (event) => {
  const preference = (event as CustomEvent<StoredConsentPreference>).detail
  startConsentedAnalytics(preference)
})
startConsentedAnalytics()
