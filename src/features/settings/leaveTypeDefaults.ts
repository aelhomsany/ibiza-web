/**
 * Default presentation for a newly created Leave Type.
 *
 * These live outside the component because `<input type="color">` needs a concrete hex value at
 * runtime and cannot read a CSS custom property, while the project rule is that components carry
 * no colour literals. Keeping them here gives the create modal, the edit modal's fallbacks, and any
 * future consumer one source of truth instead of six inline literals.
 */
export const LEAVE_TYPE_DEFAULT_PRESENTATION: {
  color: string
  backgroundColor: string
  borderColor: string
  presenceType: 'WFH' | 'OFF'
} = {
  color: '#093C5D',
  backgroundColor: '#D6E8ED',
  borderColor: '#0E4F75',
  presenceType: 'OFF',
}

/**
 * The next day in the Organization's operational timezone — the calendar the server judges
 * `effectiveFrom` against (`PolicyDraftService` uses `LocalDate.now(operationalZone.of(orgId))`).
 * Computing this in UTC seeds the wrong day for any Organization at an offset.
 */
export function nextEffectiveDate(organizationTimezone?: string | null): string {
  const zone = organizationTimezone || 'UTC'
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
  }
  const at = (type: string) => parts.find((part) => part.type === type)?.value ?? '01'
  // Local calendar date in that zone, advanced one day through UTC arithmetic on a date-only value.
  const today = new Date(`${at('year')}-${at('month')}-${at('day')}T00:00:00Z`)
  today.setUTCDate(today.getUTCDate() + 1)
  return today.toISOString().slice(0, 10)
}
