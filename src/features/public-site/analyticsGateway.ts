import { publicUuid } from '../../api/publicClient'
import {
  CONSENT_POLICY_VERSION,
  getStoredConsent,
  type StoredConsentPreference,
} from './consent/publicConsent'
import type { PublicLocale } from './PublicEvidence'

export type ApprovedPublicEvent =
  | {
      eventName: 'public_page_viewed.v1'
      dimensions: {
        route: string
        locale: PublicLocale
        source?: string
        campaign?: string
      }
      webVitals?: WebVitalsSnapshot
    }
  | {
      eventName: 'product_proof_viewed.v1'
      dimensions: {
        proofType: 'working-day' | 'distributed-team'
        route: string
        locale: PublicLocale
      }
    }
  | {
      eventName: 'pricing_plan_selected.v1'
      dimensions: {
        route: '/pricing'
        locale: PublicLocale
        plan: 'FREE' | 'STARTER' | 'GROWTH' | 'CONTACT_SALES'
        interaction: 'cta'
      }
    }
  | {
      eventName: 'contact_sales_started.v1'
      dimensions: {
        route: '/contact-sales'
        locale: PublicLocale
        formVersion: '1'
      }
    }
  | {
      eventName: 'registration_form_viewed.v1'
      dimensions: {
        route: '/register'
        locale: PublicLocale
        plan: 'FREE' | 'STARTER' | 'GROWTH'
        formVersion: '1'
      }
    }
  | {
      eventName: 'checkout_return_viewed.v1'
      dimensions: {
        route: '/register/checkout-return'
        locale: PublicLocale
        plan: 'STARTER' | 'GROWTH'
        interaction: 'success' | 'cancelled' | 'unknown'
        formVersion: '1'
      }
    }
  | {
      eventName: 'upgrade_prompt_selected.v1'
      dimensions: {
        route: string
        locale: PublicLocale
        plan: 'STARTER' | 'GROWTH' | 'CONTACT_SALES'
        interaction: string
      }
    }

export type WebVitalsSnapshot = {
  lcpMs?: number
  inpMs?: number
  clsMilli?: number
  deviceClass: 'MOBILE' | 'DESKTOP'
}

const emittedKeys = new Set<string>()

/**
 * The optional-analytics kill switch. Checked here rather than only where the page view
 * starts, so every approved event — including the Pricing and Contact Sales funnel events,
 * which are emitted straight from their components — is suppressed when it is flipped.
 */
function optionalAnalyticsDisabled(): boolean {
  return import.meta.env.VITE_PUBLIC_ANALYTICS_ENABLED === 'false'
}

function safePreference(): StoredConsentPreference | null {
  if (optionalAnalyticsDisabled()) return null
  const preference = getStoredConsent()
  return preference?.policyVersion === CONSENT_POLICY_VERSION &&
    preference.analytics === 'ACCEPTED' &&
    preference.receiptId &&
    preference.subject
    ? preference
    : null
}

export async function emitApprovedPublicEvent(event: ApprovedPublicEvent): Promise<void> {
  const preference = safePreference()
  if (!preference) return
  const subject = preference.subject
  const receiptId = preference.receiptId
  if (!subject || !receiptId) return

  const memoryKey = [
    subject,
    event.eventName,
    event.dimensions.route,
    event.dimensions.locale,
    'proofType' in event.dimensions ? event.dimensions.proofType : '',
    'plan' in event.dimensions ? event.dimensions.plan : '',
    'interaction' in event.dimensions ? event.dimensions.interaction : '',
    'formVersion' in event.dimensions ? event.dimensions.formVersion : '',
  ].join(':')
  if (emittedKeys.has(memoryKey)) return
  emittedKeys.add(memoryKey)

  try {
    const provider = await import('./optionalAnalyticsProvider')
    const eventId = publicUuid()
    await provider.sendApprovedEvent({
      ...event,
      eventId,
      schemaVersion: '1',
      sourceTimestamp: new Date().toISOString(),
      // Stable across attempts and page loads. Salting this with eventId made it
      // unique per call, so the server's unique index and DuplicateKeyException
      // convergence could never fire for a real client — a reload, a second tab,
      // or a retried keepalive beacon each wrote another outbox row.
      deduplicationKey: memoryKey,
      correlationId: publicUuid(),
      consentClass: 'OPTIONAL_ANALYTICS',
      pseudonymousSubject: subject,
      consentReceiptId: receiptId,
    })
  } catch {
    // Optional measurement failure never blocks public content or navigation.
    emittedKeys.delete(memoryKey)
  }
}

export async function startConsentedPageView(
  event: Extract<ApprovedPublicEvent, { eventName: 'public_page_viewed.v1' }>,
): Promise<void> {
  const preference = safePreference()
  if (!preference?.subject || !preference.receiptId) return

  const memoryKey = [
    preference.subject,
    event.eventName,
    event.dimensions.route,
    event.dimensions.locale,
  ].join(':')
  if (emittedKeys.has(memoryKey)) return
  emittedKeys.add(memoryKey)

  try {
    const provider = await import('./optionalAnalyticsProvider')
    const eventId = publicUuid()
    provider.startConsentedPageView({
      ...event,
      eventId,
      schemaVersion: '1',
      sourceTimestamp: new Date().toISOString(),
      // Stable across attempts — see emitApprovedPublicEvent.
      deduplicationKey: memoryKey,
      correlationId: publicUuid(),
      consentClass: 'OPTIONAL_ANALYTICS',
      pseudonymousSubject: preference.subject,
      consentReceiptId: preference.receiptId,
    })
  } catch {
    emittedKeys.delete(memoryKey)
  }
}
