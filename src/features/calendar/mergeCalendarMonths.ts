import type { CalendarMonthResponse } from '../../api/generated/types'
import { uniqueBy } from './calendarMonthUtils'

// Exported for direct unit test: the union below has no rendered surface today (only
// `CalendarAgenda` reads `availableCountByDate`, and Agenda fetches a single month), so a
// page-level test cannot observe it. Testing the function directly is what keeps the day-keyed
// union honest for the first cross-month consumer.
//
// Lives in its own module (not `TeamCalendarPage.tsx`) so that file exports only the
// `TeamCalendarPage` component -- `react-refresh/only-export-components` requires a component
// file to export nothing else.
export function mergeCalendarMonths(
  responses: CalendarMonthResponse[],
  preferredMonth: string,
): CalendarMonthResponse {
  const primary = responses.find((response) => response.month === preferredMonth) ?? responses[0]
  if (!primary) {
    throw new Error('Calendar month data is required.')
  }

  // One collision policy, stated once: **the preferred month wins**. Code review 2026-08-30 --
  // this function used to hold three different ones. Every scalar field came from `primary` via
  // the spread; `uniqueBy` keeps the first occurrence, so a duplicated absence was won by
  // whichever month happened to sort first in `responses`; and `Object.assign` keeps the last, so
  // a shared date key was won by whichever sorted last. Three answers to the same question, none
  // of them written down. Ordering `primary` first and folding the map in reverse makes all three
  // agree with the spread, so a day that both responses describe reads the same way whichever
  // field a consumer looks at.
  const ordered = [primary, ...responses.filter((response) => response !== primary)]

  return {
    ...primary,
    absences: uniqueBy(
      ordered.flatMap((response) => response.absences),
      (absence) => absence.requestId,
    ),
    holidays: uniqueBy(
      ordered.flatMap((response) => response.holidays),
      (holiday) => holiday.holidayId,
    ),
    // Date-keyed like absences and holidays, so it has to be unioned like them. Taking it from
    // `primary` alone left the secondary month's days with no entry at all, which any consumer
    // reading a cross-month week would have seen as missing data (Story 16.3 review). Folded
    // last-to-first so that `primary`, applied last, overwrites rather than is overwritten.
    availableCountByDate: responses.some((response) => response.availableCountByDate != null)
      ? Object.assign(
          {},
          ...[...ordered].reverse().map((response) => response.availableCountByDate ?? {}),
        )
      : undefined,
  }
}
