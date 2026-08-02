import { useEffect, useState } from 'react'
import ar from '../../../i18n/locales/ar/public.json'
import en from '../../../i18n/locales/en/public.json'
import type { PublicLocale } from '../PublicEvidence'
import {
  CONSENT_POLICY_VERSION,
  getStoredConsent,
  persistConsent,
  saveConsentReceipt,
  type StoredConsentPreference,
} from './publicConsent'
import './consent-preference.css'

type ConsentPreferenceProps = {
  locale?: PublicLocale
  hydrateSafe?: boolean
  onEmitAnalytics?: (event: unknown) => void
}

function documentLocale(): PublicLocale {
  if (typeof document !== 'undefined' && document.documentElement.lang === 'ar') {
    return 'ar'
  }
  return 'en'
}

export function ConsentPreference({
  locale = documentLocale(),
  hydrateSafe = false,
  onEmitAnalytics,
}: ConsentPreferenceProps) {
  const copy = locale === 'ar' ? ar.consent : en.consent
  const [preference, setPreference] = useState<StoredConsentPreference | null>(
    () => (hydrateSafe ? null : getStoredConsent()),
  )
  const [expanded, setExpanded] = useState(() =>
    hydrateSafe ? true : getStoredConsent() === null,
  )
  const [saving, setSaving] = useState(false)
  const [providerUnavailable, setProviderUnavailable] = useState(false)

  useEffect(() => {
    const stored = getStoredConsent()
    if (stored?.policyVersion === CONSENT_POLICY_VERSION) {
      setPreference(stored)
      setExpanded(false)
    } else {
      setPreference(null)
      setExpanded(true)
    }
  }, [])

  async function choose(analytics: 'ACCEPTED' | 'DECLINED') {
    setSaving(true)
    setProviderUnavailable(false)
    const receipt = await saveConsentReceipt({
      policyVersion: CONSENT_POLICY_VERSION,
      analytics,
      locale,
    })

    if (!receipt) {
      const safeFallback: StoredConsentPreference = {
        policyVersion: CONSENT_POLICY_VERSION,
        analytics: 'DECLINED',
        receiptId: null,
        subject: null,
        recordedAt: new Date().toISOString(),
      }
      persistConsent(safeFallback)
      setPreference(safeFallback)
      setProviderUnavailable(true)
      setExpanded(false)
      setSaving(false)
      window.dispatchEvent(
        new CustomEvent('ibiza:public-consent', { detail: safeFallback }),
      )
      return
    }

    const saved: StoredConsentPreference = {
      policyVersion: receipt.policyVersion,
      analytics: receipt.analytics,
      receiptId: receipt.id,
      subject: receipt.subject ?? null,
      recordedAt: new Date().toISOString(),
    }
    persistConsent(saved)
    setPreference(saved)
    setExpanded(false)
    setSaving(false)
    window.dispatchEvent(new CustomEvent('ibiza:public-consent', { detail: saved }))

    if (analytics === 'ACCEPTED') {
      onEmitAnalytics?.({ type: 'consent_accepted', policyVersion: receipt.policyVersion })
    }
  }

  const necessaryActive = preference?.analytics !== 'ACCEPTED'
  const acceptedActive = preference?.analytics === 'ACCEPTED'
  const status = providerUnavailable
    ? copy.failure
    : acceptedActive
      ? copy.savedAccepted
      : preference
        ? copy.savedDeclined
        : null

  return (
    <section
      className="consent-preference"
      aria-labelledby="consent-title"
      data-consent-policy-version={CONSENT_POLICY_VERSION}
    >
      <div className="consent-preference__copy">
        <h2 id="consent-title">{copy.title}</h2>
        <p>{copy.body}</p>
        {status ? (
          <p className="consent-preference__status" role="status">
            {status}
          </p>
        ) : null}
      </div>

      <div className="consent-preference__actions" role="group" aria-label={copy.title}>
        <button
          type="button"
          className="consent-choice"
          data-testid="consent-accept-analytics"
          aria-pressed={acceptedActive}
          disabled={saving}
          onClick={() => void choose('ACCEPTED')}
        >
          {copy.accept}
        </button>
        <button
          type="button"
          className="consent-choice"
          data-testid="consent-necessary"
          aria-pressed={necessaryActive}
          disabled={saving}
          onClick={() => void choose('DECLINED')}
        >
          {copy.necessary}
        </button>
        <button
          type="button"
          className="consent-choice"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? copy.close : copy.manage}
        </button>
      </div>

      {expanded ? (
        <p className="consent-preference__detail">
          {copy.detail}
        </p>
      ) : null}
    </section>
  )
}
