import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CONSENT_POLICY_VERSION,
  CONSENT_STORAGE_KEY,
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
  { eventName: 'public_page_viewed.v2' }
> = {
  eventName: 'public_page_viewed.v2',
  dimensions: {
    route: '/',
    locale: 'en',
    source: 'direct',
    campaign: 'none',
  },
  eventId: '00000000-0000-4000-8000-000000000001',
  schemaVersion: '2',
  sourceTimestamp: '2026-07-31T00:00:00.000Z',
  deduplicationKey: 'subject:public_page_viewed.v2:/',
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
    expect(payload.eventName).toBe('public_page_viewed.v2')
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

  // A refused event and an unreachable server are different failures. Treating them alike
  // is what let the consent UI keep reporting "Analytics accepted" while the server was
  // rejecting every event — the visitor was told their choice was in effect when it wasn't.
  it('clears stored consent when the server explicitly refuses the receipt', async () => {
    persistConsent(acceptedPreference)
    vi.stubGlobal('PerformanceObserver', SupportedPerformanceObserver)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))

    startConsentedPageView(pageView)
    window.dispatchEvent(new PageTransitionEvent('pagehide'))

    await vi.waitFor(() =>
      expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull(),
    )
  })

  it('keeps stored consent when the event merely fails to reach the server', async () => {
    persistConsent(acceptedPreference)
    vi.stubGlobal('PerformanceObserver', SupportedPerformanceObserver)
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    startConsentedPageView(pageView)
    window.dispatchEvent(new PageTransitionEvent('pagehide'))

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).not.toBeNull()
  })
})
