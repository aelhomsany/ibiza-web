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

/**
 * Stages the admin cannot finish on their own — they turn on a teammate accepting an invitation and
 * on a real leave cycle reconciling. Listing them beside the four setup stages in identical styling
 * read as one backlog, so work that was never theirs to do looked outstanding on their side.
 */
export const WAITING_STAGES = new Set<OnboardingStageId>(['FIRST_LEAVE_CYCLE'])

export function isWaitingStage(stageId: OnboardingStageId): boolean {
  return WAITING_STAGES.has(stageId)
}

/**
 * Same-origin app paths only.
 *
 * The backslash case is not theoretical: `/\evil.com` starts with `/` and does not start with `//`,
 * but browsers normalise `\` to `/` while parsing, so a plain `startsWith` pair renders an anchor
 * that resolves off-origin the moment it is middle-clicked or opened in a new tab — the router only
 * intercepts the ordinary left click.
 */
export function safeHref(href: string | undefined): string {
  if (!href || !/^\/[^/\\]/.test(href)) return href === '/' ? '/' : '/settings'
  return href
}

/**
 * Marks the destination as reached from guided setup so `SetupReturnNotice` can offer the way back.
 * The page tells the user to "return here afterward"; without carrying the origin, nothing on the
 * destination could honour that. The dashboard carries its own cue, so `/` is left alone.
 */
export function withSetupReturn(href: string): string {
  if (href === '/') return href
  // Split the fragment off first. `'/settings#section'.split('?')` yields no query at all, so a
  // naive append lands the marker *inside* the fragment (`/settings#section?from=onboarding`) —
  // the URL still resolves, but `useSearchParams` never sees `from` and the return notice silently
  // never renders.
  const [base, ...fragment] = href.split('#')
  const [path, ...query] = base.split('?')
  const params = new URLSearchParams(query.join('?'))
  params.set('from', 'onboarding')
  const hash = fragment.length > 0 ? `#${fragment.join('#')}` : ''
  return `${path}?${params.toString()}${hash}`
}

/**
 * The row's own destination — always the static table.
 *
 * The server's `nextSafeAction.href` is deliberately *not* consulted here. It points at the next
 * sub-step rather than at the stage, so honouring it moved a row under the user between visits:
 * "First leave cycle" linked to `/approvals` while it was the recommended stage and `/my-leaves`
 * once it was not. A row now always means the same destination; the Continue button remains the
 * place where the server's more precise next step is offered.
 */
export function stageHref(stageId: OnboardingStageId): string {
  return withSetupReturn(safeHref(STAGE_HREFS[stageId]))
}
