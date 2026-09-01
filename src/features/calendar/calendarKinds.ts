import type { CalendarAbsenceResponse } from '../../api/generated/types'

/**
 * The kinds of thing the timeline draws, which are exactly the things the legend names. The
 * legend doubles as the filter control, so one vocabulary serves both: a chip the reader can
 * see is a chip the reader can switch off.
 *
 * PENDING is the viewer's own unapproved request. It carries presence OFF on the wire, so it
 * is separated here rather than derived from `presence` — it has its own legend chip and its
 * own dashed treatment, and folding it into OFF would make that chip unfilterable.
 */
export type CalendarKind = 'OFF' | 'WFH' | 'PENDING' | 'HOLIDAY'

type KindableAbsence = Pick<CalendarAbsenceResponse, 'presence'> & { pending?: boolean }

export function kindOfAbsence(absence: KindableAbsence): CalendarKind {
  if (absence.pending) {
    return 'PENDING'
  }
  return absence.presence === 'WFH' ? 'WFH' : 'OFF'
}

/**
 * `null` means "no filter" — the timeline opens showing every kind and stays that way until
 * the reader picks one. One kind at a time: clicking a legend chip shows that kind ONLY, and
 * clicking the lit chip clears back to everything.
 */
export function isKindVisible(kind: CalendarKind, activeKind: CalendarKind | null): boolean {
  return activeKind == null || activeKind === kind
}

export function nextActiveKind(
  current: CalendarKind | null,
  clicked: CalendarKind,
): CalendarKind | null {
  return current === clicked ? null : clicked
}
