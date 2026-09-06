import { useQuery } from '@tanstack/react-query'
import { ApiError, getCapabilityAccess, listReportExports } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export const REPORTING_CAPABILITY = 'ADVANCED_REPORTING'

export function reportingCapabilityQueryKey(userId: number | undefined) {
  return ['billing', 'capability', REPORTING_CAPABILITY, userId] as const
}

export type ReportingAccess = {
  /** The plan entitles the Report Center: filters, queries and new exports are all allowed. */
  available: boolean
  /**
   * Billing is restricted but exports created earlier are still readable. AC3's one sanctioned
   * exception, and the only reason to show the workspace when `available` is false.
   */
  recovery: boolean
}

/**
 * Whether this organization can reach the Report Center, and in which of the two modes.
 *
 * `ADVANCED_REPORTING` stays `COMING_SOON` in the production catalog until Story 13.5 promotes it,
 * so without this probe every Organization administrator would see a Reports nav item that lands on a denial
 * banner. The route guard stays role-based on purpose: a direct URL still reaches the page and
 * shows the server's honest denial.
 *
 * The capability gate alone was not enough. It denies a RESTRICTED organization, which hid the nav
 * item and left the restricted-recovery states — the whole point of Story 13.3 — unreachable. The
 * export list is authorized by the recovery-aware gate instead, so a second probe distinguishes
 * "not entitled at all" from "restricted, with exports still to collect".
 *
 * Defaults to unavailable while loading — showing the entry point and then withdrawing it reads as
 * a broken link.
 */
export function useReportingCapability() {
  const { user } = useAuth()
  return useQuery<ReportingAccess>({
    queryKey: reportingCapabilityQueryKey(user?.id),
    queryFn: async () => {
      try {
        await getCapabilityAccess(REPORTING_CAPABILITY)
        return { available: true, recovery: false }
      } catch (error) {
        // 403 is the gate's normal "not entitled" answer, not a failure.
        if (!(error instanceof ApiError) || error.status !== 403) {
          throw error
        }
      }
      try {
        const existing = await listReportExports()
        return { available: false, recovery: existing.length > 0 }
      } catch (recoveryError) {
        // A cancelled or suspended tenant is denied here too, which is the correct answer.
        if (recoveryError instanceof ApiError && recoveryError.status === 403) {
          return { available: false, recovery: false }
        }
        throw recoveryError
      }
    },
    enabled: user?.id != null && user.role === 'ORGANIZATION_ADMIN',
    staleTime: 5 * 60_000,
    retry: false,
  })
}
