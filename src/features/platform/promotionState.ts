import type { TFunction } from 'i18next'
import type { ReportingPromotionResponse } from '../../api/generated/types'

type PromotionState = NonNullable<ReportingPromotionResponse['state']>

/**
 * Maps a promotion state to its label through a static key table.
 *
 * A runtime-built key — `t(`promotion.states.${state.toLowerCase()}`)` — cannot be extracted by
 * `verify:i18n`, and its previous `?? 'expired'` fallback labelled any unrecognised state as
 * "Expired": a server state this build does not know about would have been reported as closed
 * while it was in fact entitling the Organization.
 */
const STATE_KEYS: Record<string, string> = {
  SCHEDULED: 'platform:promotion.states.scheduled',
  ACTIVE: 'platform:promotion.states.active',
  EXPIRED: 'platform:promotion.states.expired',
  REVOKED: 'platform:promotion.states.revoked',
}

export function promotionStateLabel(
  t: TFunction<['platform', 'common']>,
  state: PromotionState | string | null | undefined,
): string {
  const key = state ? STATE_KEYS[state] : undefined
  return key ? t(key) : t('platform:promotion.states.unknown')
}
