import type { OnboardingStageId } from '../../api/client'

/**
 * Where each stage is actually completed.
 *
 * The server stays the authority on which stage comes *next* (`nextSafeAction.href`); this is the
 * client's own route table, and it is what lets an admin work the stages in any order — including
 * revisiting ones already complete. Nothing in Settings enforces the rail's numbering, so a UI that
 * only ever offered stage N was inventing a constraint the domain does not have.
 */
export const STAGE_HREFS: Record<OnboardingStageId, string> = {
  ORGANIZATION: '/settings?category=organization',
  WORKING_CALENDARS: '/settings?category=working-calendars',
  PEOPLE_AND_INVITATIONS: '/settings?category=people',
  ENTITLEMENTS_AND_READINESS: '/settings?category=leave-policies',
  // The leave cycle is exercised through the real request flow, not a settings category.
  FIRST_LEAVE_CYCLE: '/my-leaves',
}

export function safeHref(href: string | undefined): string {
  if (!href || !href.startsWith('/') || href.startsWith('//')) return '/settings'
  return href
}

/**
 * Marks the destination as reached from guided setup so `SetupReturnNotice` can offer the way back.
 * The page tells the user to "return here afterward"; without carrying the origin, nothing on the
 * destination could honour that. The dashboard carries its own cue, so `/` is left alone.
 */
export function withSetupReturn(href: string): string {
  if (href === '/') return href
  const [path, query] = href.split('?')
  const params = new URLSearchParams(query)
  params.set('from', 'onboarding')
  return `${path}?${params.toString()}`
}

/**
 * The row's own destination. Prefers the server's next-safe-action href for the recommended stage
 * so the two never disagree, and falls back to the static table for every other row.
 */
export function stageHref(
  stageId: OnboardingStageId,
  nextSafeAction?: { stage: OnboardingStageId; href: string },
): string {
  const href = nextSafeAction?.stage === stageId ? nextSafeAction.href : STAGE_HREFS[stageId]
  return withSetupReturn(safeHref(href))
}
