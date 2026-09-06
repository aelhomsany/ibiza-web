/**
 * IANA zones the browser knows about, with the caller's own zone and UTC guaranteed present.
 *
 * The server rejects anything outside `ZoneId.getAvailableZoneIds()`, so offering a closed list is
 * what keeps an invalid zone from costing a round trip. `Intl.supportedValuesOf` lists only
 * location zones (no "UTC", no "Etc/*"), which the server does accept and a distributed team may
 * genuinely want, so UTC is appended. Shared by the report centre and the Working calendars group
 * settings.
 */
export function availableTimezones(current: string): string[] {
  let zones: string[]
  try {
    zones = Intl.supportedValuesOf?.('timeZone') ?? []
  } catch {
    zones = []
  }
  if (!zones.includes('UTC')) zones = [...zones, 'UTC']
  return zones.includes(current) ? zones : [current, ...zones]
}
