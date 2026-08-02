import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CONSENT_POLICY_VERSION,
  persistConsent,
  type StoredConsentPreference,
} from './consent/publicConsent'
import {
  startConsentedPageView,
  type AnalyticsEnvelope,
} from './optionalAnalyticsProvider'

const acceptedPreference: StoredConsentPreference = {
  policyVersion: CONSENT_POLICY_VERSION,
  analytics: 'ACCEPTED',
  receiptId: 'receipt-1',
  subject: 'a'.repeat(64),
  recordedAt: '2026-07-31T00:00:00.000Z',
}

const pageView: Extract<
  AnalyticsEnvelope,
  { eventName: 'public_page_viewed.v1' }
> = {
  eventName: 'public_page_viewed.v1',
  dimensions: {
    route: '/',
    locale: 'en',
    source: 'direct',
    campaign: 'none',
  },
  eventId: '00000000-0000-4000-8000-000000000001',
  schemaVersion: '1',
  sourceTimestamp: '2026-07-31T00:00:00.000Z',
  deduplicationKey: 'subject:public_page_viewed.v1:/',
  correlationId: '00000000-0000-4000-8000-000000000002',
  consentClass: 'OPTIONAL_ANALYTICS',
  pseudonymousSubject: 'a'.repeat(64),
  consentReceiptId: 'receipt-1',
}

class SupportedPerformanceObserver {
  observe() {}
  disconnect() {}
}

describe('consented Web Vitals provider — Story 12.1', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it('reports a bounded page-view snapshot only while current consent remains accepted', async () => {
    persistConsent(acceptedPreference)
    vi.stubGlobal('PerformanceObserver', SupportedPerformanceObserver)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    startConsentedPageView(pageView)
    window.dispatchEvent(new PageTransitionEvent('pagehide'))

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const request = fetchMock.mock.calls[0][1] as RequestInit
    const payload = JSON.parse(String(request.body)) as {
      eventName: string
      webVitals: { clsMilli: number; deviceClass: string }
    }
    expect(request.keepalive).toBe(true)
    expect(payload.eventName).toBe('public_page_viewed.v1')
    expect(payload.webVitals.clsMilli).toBe(0)
    expect(payload.webVitals.deviceClass).toMatch(/MOBILE|DESKTOP/)
  })

  it('disconnects without reporting when analytics is withdrawn', async () => {
    persistConsent(acceptedPreference)
    vi.stubGlobal('PerformanceObserver', SupportedPerformanceObserver)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    startConsentedPageView(pageView)
    window.dispatchEvent(
      new CustomEvent<StoredConsentPreference>('ibiza:public-consent', {
        detail: {
          ...acceptedPreference,
          analytics: 'DECLINED',
          receiptId: 'receipt-2',
          subject: null,
        },
      }),
    )
    window.dispatchEvent(new PageTransitionEvent('pagehide'))

    await Promise.resolve()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
