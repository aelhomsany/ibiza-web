/**
 * Whether this user has asked not to be sent to guided setup on sign-in.
 *
 * Sign-in redirected every HR Admin to `/onboarding` until setup completed, with no way to say
 * "not now" that survived the next login — so an admin signing in to approve a request was sent
 * somewhere else first, every time.
 *
 * Client-side on purpose: this is a navigation preference, not workflow state. Story 12.5's rule is
 * that local storage cannot mark a step complete or create an activation, and this does neither —
 * evidence and progress stay server-owned, and the dashboard cue still offers the way back.
 *
 * Keyed per user: a shared browser must not let one account's preference silence another's.
 */
const KEY_PREFIX = 'ibiza.onboarding.autoRedirectOptOut'

function storageKey(userId: number | string): string {
  return `${KEY_PREFIX}:${userId}`
}

export function hasSkippedOnboardingRedirect(userId: number | string | undefined): boolean {
  if (userId === undefined) return false
  try {
    return window.localStorage.getItem(storageKey(userId)) === '1'
  }
  catch {
    // Private mode or a storage-disabled browser. Falling back to "not skipped" keeps the guided
    // path working; the user can still navigate away.
    return false
  }
}

export function skipOnboardingRedirect(userId: number | string | undefined): void {
  if (userId === undefined) return
  try {
    window.localStorage.setItem(storageKey(userId), '1')
  }
  catch {
    // Preference is best-effort; failing to persist must never block the navigation itself.
  }
}

/**
 * Drops the opt-out once it has nothing left to suppress.
 *
 * Without this the flag outlives the thing it was refusing: one click disabled the sign-in resume
 * for the life of the browser profile, and the keys accumulated one per account that ever signed in
 * here. Clearing on completion means a later setup cycle is not silently suppressed by a decision
 * the user made about a workflow that has since finished.
 */
export function clearOnboardingRedirectSkip(userId: number | string | undefined): void {
  if (userId === undefined) return
  try {
    window.localStorage.removeItem(storageKey(userId))
  }
  catch {
    // Same best-effort contract as the write.
  }
}
