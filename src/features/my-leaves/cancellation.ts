import type { RecentRequestResponse } from '../../api/generated/types'

/** Which of the three cancellation conversations a row offers. */
export type CancelLeaveVariant = 'WITHDRAW' | 'CANCEL' | 'REVIEW'

/**
 * Plan VUELTA / CANCEL-UI-VAL-001. The action a row renders follows the server's `cancellation`
 * block and nothing else. The SPA never compares `dateFrom` to today: "started" is decided in the
 * Workforce Group's IANA zone, so a browser in another zone would draw a Cancel button that works
 * in the morning and 409s at 21:05 UTC.
 *
 * `status` picks only between the two SELF_SERVICE wordings — withdrawing a request nobody has
 * approved gives nothing back because nothing was charged, while cancelling an approved one names
 * the days that return. It never decides *whether* the action exists.
 */
export function cancelVariantFor(
  request: RecentRequestResponse,
): CancelLeaveVariant | null {
  const capability = request.cancellation
  if (!capability?.cancellable) {
    return null
  }
  if (capability.mode === 'ADMIN_REVIEW') {
    return 'REVIEW'
  }
  if (capability.mode === 'SELF_SERVICE') {
    return request.status === 'PENDING' ? 'WITHDRAW' : 'CANCEL'
  }
  return null
}
