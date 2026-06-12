/** Browser IANA timezone for login (FR-33). */
export function getBrowserTimezone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!zone || zone.length === 0) return 'UTC'
    // Some old browsers return offset strings (+08:00, UTC+8) instead of IANA names
    if (/^[+-]\d{2}:\d{2}$/.test(zone) || /^UTC[+-]/.test(zone)) return 'UTC'
    return zone
  } catch {
    return 'UTC'
  }
}
