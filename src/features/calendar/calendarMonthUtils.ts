import type { CalendarAbsenceResponse, CalendarHolidayResponse, DayOfWeek } from '../../api/generated/types'

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const dayOfWeekByIndex: DayOfWeek[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]

export type CalendarCell =
  | { kind: 'blank'; key: string }
  | {
      kind: 'day'
      date: string
      dayNumber: number
      dayOfWeek: DayOfWeek
    }

export function yearMonthFromDate(date: string): string {
  return date.slice(0, 7)
}

export function formatYearMonthLabel(month: string): string {
  const [year, monthValue] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthValue - 1, 1)))
}

/** Full human-readable date ("Friday, July 3, 2026") for screen-reader labels. */
export function formatFullDate(date: string): string {
  const [year, monthValue, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthValue - 1, day)))
}

export function addMonths(month: string, delta: number): string {
  const [year, monthValue] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthValue - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function buildCalendarCells(month: string): CalendarCell[] {
  const [year, monthValue] = month.split('-').map(Number)
  const firstDay = new Date(Date.UTC(year, monthValue - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthValue, 0)).getUTCDate()
  const cells: CalendarCell[] = Array.from({ length: firstDay }, (_, index) => ({
    kind: 'blank' as const,
    key: `blank-${index}`,
  }))

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`
    const dayOfWeek = dayOfWeekByIndex[new Date(Date.UTC(year, monthValue - 1, day)).getUTCDay()]
    cells.push({
      kind: 'day',
      date,
      dayNumber: day,
      dayOfWeek,
    })
  }

  return cells
}

export function dateInRange(date: string, dateFrom: string, dateTo: string): boolean {
  return date >= dateFrom && date <= dateTo
}

export function absencesForDate(
  date: string,
  absences: CalendarAbsenceResponse[],
): CalendarAbsenceResponse[] {
  return absences.filter((absence) => dateInRange(date, absence.dateFrom, absence.dateTo))
}

export function holidaysForDate(
  date: string,
  holidays: CalendarHolidayResponse[],
): CalendarHolidayResponse[] {
  return holidays.filter((holiday) => dateInRange(date, holiday.dateFrom, holiday.dateTo))
}

export function uniqueBy<T>(items: T[], getKey: (item: T) => string | number): T[] {
  const seen = new Set<string | number>()
  return items.filter((item) => {
    const key = getKey(item)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}

// Number of user color tokens defined in calendar.css (cal-event--user-0 … --user-7).
// The API assigns userColorKey as user-0..user-(N-1) for every user in the org with no
// upper bound, so the unbounded index must wrap into the fixed palette to avoid rendering
// background-less (invisible) chips/dots for the 9th+ user with absences in a month.
export const USER_COLOR_PALETTE_SIZE = 8

export function userColorClass(prefix: string, userColorKey: string): string {
  const rawIndex = Number.parseInt(userColorKey.replace(/^user-/, ''), 10)
  const index = Number.isFinite(rawIndex)
    ? ((rawIndex % USER_COLOR_PALETTE_SIZE) + USER_COLOR_PALETTE_SIZE) % USER_COLOR_PALETTE_SIZE
    : 0
  return `${prefix}--user-${index}`
}
