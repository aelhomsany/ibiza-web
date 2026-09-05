import { publicUuid } from '../../../api/publicClient'
import type { PublicLocale } from '../PublicEvidence'

export const CONSENT_POLICY_VERSION = '2026-07-31'
export const CONSENT_STORAGE_KEY = 'leaveo_public_consent_v1'

export type ConsentAnalytics = 'ACCEPTED' | 'DECLINED'

export type StoredConsentPreference = {
  policyVersion: string
  analytics: ConsentAnalytics
  receiptId: string | null
  subject: string | null
  recordedAt: string
}

type ConsentReceiptRequest = {
  policyVersion: string
  analytics: ConsentAnalytics
  locale: PublicLocale
}

type ConsentReceiptResponse = {
  id: string
  policyVersion: string
  analytics: ConsentAnalytics
  locale: PublicLocale
  subject?: string | null
}

function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL ?? ''
  return configured === 'http://localhost:8080' ? '' : configured
}

export function getStoredConsent(): StoredConsentPreference | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredConsentPreference>
    if (
      parsed.policyVersion !== CONSENT_POLICY_VERSION ||
      (parsed.analytics !== 'ACCEPTED' && parsed.analytics !== 'DECLINED')
    ) {
      return null
    }
    if (parsed.analytics === 'ACCEPTED' && (!parsed.receiptId || !parsed.subject)) {
      return null
    }
    return {
      policyVersion: parsed.policyVersion,
      analytics: parsed.analytics,
      receiptId: parsed.receiptId ?? null,
      subject: parsed.subject ?? null,
      recordedAt: parsed.recordedAt ?? '',
    }
  } catch {
    return null
  }
}

export function persistConsent(preference: StoredConsentPreference): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(preference))
  } catch {
    // Preference persistence failure leaves the site in Necessary Only mode on reload.
  }
}

/**
 * Drops the stored preference so the consent prompt reappears on the next render.
 * Used when the server explicitly refuses a consented event: the receipt the visitor is
 * carrying is no longer honoured, and continuing to display "Analytics accepted" while
 * every event is refused is the one outcome the consent UI must never produce.
 */
export function clearStoredConsent(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY)
  } catch {
    // Storage removal can fail in private modes; the notification below still resets the
    // live UI, so the visitor is not left looking at a stale "accepted" state.
  }
  // Same channel the consent controls use, so in-flight measurement stops and the prompt
  // returns without a reload. A null detail means "no preference on record".
  window.dispatchEvent(new CustomEvent('leaveo:public-consent', { detail: null }))
}

export async function saveConsentReceipt(
  payload: ConsentReceiptRequest,
): Promise<ConsentReceiptResponse | null> {
  try {
    const response = await fetch(`${apiBaseUrl()}/api/v1/consent-receipts`, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': publicUuid(),
      },
      body: JSON.stringify(payload),
    })
    if (!response.ok) return null
    return (await response.json()) as ConsentReceiptResponse
  } catch {
    return null
  }
}
