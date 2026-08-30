import { describe, expect, it } from 'vitest'

import { mergeCalendarMonths } from './mergeCalendarMonths'
import { mockCalendarMonth } from './calendarTestFixtures'

import type { CalendarMonthResponse } from '../../api/generated/types'

function monthResponse(
  month: string,
  availableCountByDate: Record<string, number> | undefined,
): CalendarMonthResponse {
  return {
    ...mockCalendarMonth,
    month,
    monthStart: `${month}-01`,
    monthEnd: `${month}-28`,
    absences: [],
    holidays: [],
    availableCountByDate,
  }
}

describe('mergeCalendarMonths', () => {
  // AVAIL-UI-VAL-004 (P1): `availableCountByDate` is date-keyed like absences and holidays, so a
  // cross-month week has to union it the same way. Carrying it from the primary month alone
  // leaves every day of the secondary month with no entry -- which a consumer reading a
  // Jun 28 - Jul 4 week cannot distinguish from "the server never computed those days".
  it('[P1] unions the day-keyed availability map across both months', () => {
    const merged = mergeCalendarMonths(
      [
        monthResponse('2026-06', { '2026-06-30': 6 }),
        monthResponse('2026-07', { '2026-07-01': 4 }),
      ],
      '2026-06',
    )

    expect(merged.month).toBe('2026-06')
    expect(merged.availableCountByDate).toEqual({ '2026-06-30': 6, '2026-07-01': 4 })
  })

  // A server that omits the map entirely must stay omitted, not become `{}`: an empty object is a
  // map that was computed and found empty, which reads as "no day has a count" rather than "this
  // response does not carry counts". `CalendarAgenda` renders those two states differently.
  it('[P1] leaves the map undefined when no month carried one', () => {
    const merged = mergeCalendarMonths(
      [monthResponse('2026-06', undefined), monthResponse('2026-07', undefined)],
      '2026-06',
    )

    expect(merged.availableCountByDate).toBeUndefined()
  })
})
