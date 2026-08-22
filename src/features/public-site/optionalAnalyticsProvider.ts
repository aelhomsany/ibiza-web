import type { ApprovedPublicEvent } from './analyticsGateway'
import {
  CONSENT_POLICY_VERSION,
  clearStoredConsent,
  getStoredConsent,
  type StoredConsentPreference,
} from './consent/publicConsent'

export type AnalyticsEnvelope = ApprovedPublicEvent & {
  eventId: string
  schemaVersion: '1' | '2'
  sourceTimestamp: string
  deduplicationKey: string
  correlationId: string
  consentClass: 'OPTIONAL_ANALYTICS'
  pseudonymousSubject: string
  consentReceiptId: string
}

function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL ?? ''
  return configured === 'http://localhost:8080' ? '' : configured
}

export async function sendApprovedEvent({
  consentReceiptId,
  ...event
}: AnalyticsEnvelope, keepalive = false): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/api/v1/analytics/events`, {
    method: 'POST',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      'X-Consent-Receipt-Id': consentReceiptId,
      'X-Correlation-Id': event.correlationId,
    },
    body: JSON.stringify(event),
    keepalive,
  })
  if (!response.ok) {
    throw new AnalyticsRejectedError(response.status)
  }
}

/**
 * Carries the refusal status. Without it a 403 — the server saying this receipt is not
 * honoured — is indistinguishable from an offline blip, and the gateway retries forever
 * while the UI keeps claiming analytics are being collected.
 */
export class AnalyticsRejectedError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Optional analytics event was not accepted (${status})`)
    this.name = 'AnalyticsRejectedError'
    this.status = status
  }
}

/**
 * True only when the server refused the consent itself. A 400 means the payload was
 * malformed — a client bug, not a withdrawn consent — and must not clear the preference.
 */
export function isConsentRejection(error: unknown): boolean {
  return error instanceof AnalyticsRejectedError && error.status === 403
}

type LargestContentfulPaintEntry = PerformanceEntry & {
  renderTime?: number
  loadTime?: number
}

type LayoutShiftEntry = PerformanceEntry & {
  value: number
  hadRecentInput: boolean
}

type InteractionTimingEntry = PerformanceEntry & {
  interactionId?: number
}

function isSameAcceptedConsent(
  preference: StoredConsentPreference | null,
  receiptId: string,
): boolean {
  return (
    preference?.policyVersion === CONSENT_POLICY_VERSION &&
    preference.analytics === 'ACCEPTED' &&
    preference.receiptId === receiptId
  )
}

export function startConsentedPageView(
  event: Extract<AnalyticsEnvelope, { eventName: 'public_page_viewed.v2' }>,
): void {
  const observers: PerformanceObserver[] = []
  let lcpMs: number | undefined
  let inpMs: number | undefined
  let cls = 0
  let clsSessionValue = 0
  let clsSessionStart: number | undefined
  let clsSessionLast: number | undefined
  let observesCls = false
  let finished = false
  const interactionDurations = new Map<number, number>()

  function observe(
    type: string,
    callback: (entries: PerformanceEntry[]) => void,
    options: PerformanceObserverInit = { type, buffered: true },
  ) {
    if (!('PerformanceObserver' in window)) return
    try {
      const observer = new PerformanceObserver((list) => callback(list.getEntries()))
      observer.observe(options)
      observers.push(observer)
      if (type === 'layout-shift') observesCls = true
    } catch {
      // Unsupported metric types are omitted from the field snapshot.
    }
  }

  observe('largest-contentful-paint', (entries) => {
    for (const item of entries as LargestContentfulPaintEntry[]) {
      lcpMs = Math.max(lcpMs ?? 0, item.renderTime ?? item.loadTime ?? item.startTime)
    }
  })
  observe('layout-shift', (entries) => {
    for (const item of entries as LayoutShiftEntry[]) {
      if (item.hadRecentInput) continue
      const continuesSession =
        clsSessionStart !== undefined &&
        clsSessionLast !== undefined &&
        item.startTime - clsSessionLast < 1_000 &&
        item.startTime - clsSessionStart < 5_000
      clsSessionValue = continuesSession ? clsSessionValue + item.value : item.value
      clsSessionStart = continuesSession ? clsSessionStart : item.startTime
      clsSessionLast = item.startTime
      cls = Math.max(cls, clsSessionValue)
    }
  })
  observe(
    'event',
    (entries) => {
      for (const item of entries as InteractionTimingEntry[]) {
        if (!item.interactionId) continue
        interactionDurations.set(
          item.interactionId,
          Math.max(interactionDurations.get(item.interactionId) ?? 0, item.duration),
        )
      }
      const descending = [...interactionDurations.values()].sort((a, b) => b - a)
      inpMs = descending[Math.floor(descending.length / 50)]
    },
    { type: 'event', buffered: true, durationThreshold: 40 } as PerformanceObserverInit,
  )

  function cleanUp() {
    observers.forEach((observer) => observer.disconnect())
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', finish)
    window.removeEventListener('ibiza:public-consent', onConsentChange)
  }

  function finish() {
    if (finished) return
    finished = true
    cleanUp()
    if (!isSameAcceptedConsent(getStoredConsent(), event.consentReceiptId)) return

    const measured = lcpMs !== undefined || inpMs !== undefined || observesCls
    void sendApprovedEvent(
      {
        ...event,
        webVitals: measured
          ? {
              ...(lcpMs === undefined ? {} : { lcpMs: Math.round(lcpMs) }),
              ...(inpMs === undefined ? {} : { inpMs: Math.round(inpMs) }),
              ...(observesCls ? { clsMilli: Math.round(cls * 1000) } : {}),
              deviceClass: window.innerWidth <= 900 ? 'MOBILE' : 'DESKTOP',
            }
          : undefined,
      },
      true,
    ).catch((error: unknown) => {
      // Field measurement remains optional and never disrupts navigation — but a refusal
      // of the consent itself is not a measurement failure, and must not be absorbed here.
      if (isConsentRejection(error)) clearStoredConsent()
    })
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') finish()
  }

  function onConsentChange(changed: Event) {
    const preference = (changed as CustomEvent<StoredConsentPreference>).detail
    if (!isSameAcceptedConsent(preference, event.consentReceiptId)) {
      finished = true
      cleanUp()
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', finish)
  window.addEventListener('ibiza:public-consent', onConsentChange)
}
