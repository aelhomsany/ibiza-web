import type { TFunction } from 'i18next'
import type { RecentRequestResponse } from '../../api/generated/types'

export function formatDate(iso: string, locale?: string): string {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateRange(from: string, to: string, locale?: string): string {
  if (from === to) {
    return formatDate(from, locale)
  }
  return `${formatDate(from, locale)} – ${formatDate(to, locale)}`
}

/**
 * Dashboard APIs currently include an English statusHint. Map the structured
 * status fields to localized UI copy instead of rendering that server hint.
 */
export function localizedRequestStatusHint(
  request: RecentRequestResponse,
  t: TFunction,
): string | null {
  if (request.status === 'PENDING') {
    return t('dashboard:statusHints.pending')
  }
  if (request.status === 'APPROVED') {
    const evidence = request.approvalEvidence ?? []
    if (evidence.length > 1) {
      const recorded = evidence.filter((step) => step.result != null).length
      return t('dashboard:statusHints.approvalProgress', {
        recorded,
        total: evidence.length,
      })
    }
    return request.approverFirstName
      ? t('dashboard:statusHints.approvedBy', {
          name: request.approverFirstName,
        })
      : t('dashboard:statusHints.approved')
  }
  return null
}
