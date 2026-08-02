import type { PublicPlanCode } from '../../api/publicClient'
import type { PublicLocale } from './PublicEvidence'

const INTENT_KEY = 'ibiza_public_plan_intent_v1'

export type PublicPlanIntent = {
  plan: PublicPlanCode
  intendedCount: number
  locale: PublicLocale
  recordedAt: string
}

export function createPublicPlanIntent(
  plan: PublicPlanCode,
  intendedCount: number,
  locale: PublicLocale,
): PublicPlanIntent {
  return { plan, intendedCount, locale, recordedAt: new Date().toISOString() }
}

export function preservePublicPlanIntent(
  plan: PublicPlanCode,
  intendedCount: number,
  locale: PublicLocale,
): PublicPlanIntent {
  const intent = createPublicPlanIntent(plan, intendedCount, locale)
  try {
    window.sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent))
  } catch {
    // The URL still preserves the same intent when storage is unavailable.
  }
  return intent
}

export function intentQuery(intent: PublicPlanIntent): string {
  return new URLSearchParams({
    plan: intent.plan,
    intendedCount: String(intent.intendedCount),
    locale: intent.locale,
  }).toString()
}
