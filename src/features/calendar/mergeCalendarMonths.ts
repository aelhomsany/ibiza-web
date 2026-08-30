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
  return {
    ...primary,
    absences: uniqueBy(
      responses.flatMap((response) => response.absences),
      (absence) => absence.requestId,
    ),
    holidays: uniqueBy(
      responses.flatMap((response) => response.holidays),
      (holiday) => holiday.holidayId,
    ),
    // Date-keyed like absences and holidays, so it has to be unioned like them. Taking it from
    // `primary` alone left the secondary month's days with no entry at all, which any consumer
    // reading a cross-month week would have seen as missing data (Story 16.3 review).
    availableCountByDate: responses.some((response) => response.availableCountByDate != null)
      ? Object.assign({}, ...responses.map((response) => response.availableCountByDate ?? {}))
      : undefined,
  }
}
