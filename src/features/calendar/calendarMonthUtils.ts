import type {
  CalendarAbsenceResponse,
  CalendarHolidayResponse,
  DayOfWeek,
} from '../../api/generated/types'

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

function parseIsoDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function toIsoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function formatIsoDate(
  date: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
    parseIsoDate(date),
  )
}

export function currentLocalDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function yearMonthFromDate(date: string): string {
  return date.slice(0, 7)
}

export function dayOfWeekForDate(date: string): DayOfWeek {
  return dayOfWeekByIndex[parseIsoDate(date).getUTCDay()]
}

export function addDays(date: string, delta: number): string {
  const nextDate = parseIsoDate(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + delta)
  return toIsoDate(nextDate)
}

export function daysBetweenInclusive(dateFrom: string, dateTo: string): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  return Math.floor(
    (parseIsoDate(dateTo).getTime() - parseIsoDate(dateFrom).getTime())
      / millisecondsPerDay,
  ) + 1
}

/**
 * Server-authoritative working-day progress for an absence on a given day.
 * `workingDates` is the ordered list of charged working days supplied by the API
 * (FR-11 single source of truth); the position is how many of them fall on or
 * before `date`. Returns 0 when the list is missing/empty so callers can hide the
 * label rather than recompute working-day math on the client.
 */
export function workingDayPosition(
  workingDates: string[] | undefined,
  date: string,
): number {
  if (workingDates == null || workingDates.length === 0) {
    return 0
  }
  return workingDates.filter((workingDate) => workingDate <= date).length
}

const dayIndexByDayOfWeek: Record<DayOfWeek, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
}

// The day after the end of the configured (contiguous) weekend block, so a
// non-Sunday-start weekend (e.g. Friday+Saturday) still renders as a
// contiguous block instead of being split across the first/last columns.
// Falls back to Sunday (index 0) when no weekend is configured yet.
function weekStartDayIndex(weekendDays: DayOfWeek[]): number {
  if (weekendDays.length === 0) {
    return 0
  }
  const weekendIndices = new Set(weekendDays.map((day) => dayIndexByDayOfWeek[day]))
  const lastWeekendIndex = [...weekendIndices].find(
    (index) => !weekendIndices.has((index + 1) % 7),
  )
  return lastWeekendIndex == null ? 0 : (lastWeekendIndex + 1) % 7
}

export function startOfWeek(date: string, weekendDays: DayOfWeek[] = []): string {
  const weekStartIndex = weekStartDayIndex(weekendDays)
  const currentIndex = parseIsoDate(date).getUTCDay()
  const offset = (currentIndex - weekStartIndex + 7) % 7
  return addDays(date, -offset)
}

export function buildWeekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
}

export function monthsForWeek(weekStart: string): string[] {
  return uniqueBy(buildWeekDates(weekStart).map(yearMonthFromDate), (month) => month)
}

export function formatYearMonthLabel(month: string, locale = 'en-US'): string {
  return formatIsoDate(`${month}-01`, locale, { month: 'long', year: 'numeric' })
}

export function formatWeekLabel(weekStart: string, locale = 'en-US'): string {
  const weekEnd = addDays(weekStart, 6)
  const startYear = weekStart.slice(0, 4)
  const endYear = weekEnd.slice(0, 4)
  const startLabel = formatIsoDate(weekStart, locale, {
    month: 'short',
    day: 'numeric',
    ...(startYear === endYear ? {} : { year: 'numeric' }),
  })
  const endLabel = formatIsoDate(weekEnd, locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${startLabel} – ${endLabel}`
}

export function formatTimelineDay(date: string, locale = 'en-US'): string {
  const weekday = formatIsoDate(date, locale, { weekday: 'short' })
  const day = formatIsoDate(date, locale, { day: 'numeric' })
  return `${weekday} ${day}`
}

export function formatWeekStripWeekday(date: string, locale = 'en-US'): string {
  return formatIsoDate(date, locale, {
    weekday: locale.toLowerCase().startsWith('ar') ? 'narrow' : 'short',
  })
}

export function formatDayNumber(date: string, locale = 'en-US'): string {
  return formatIsoDate(date, locale, { day: 'numeric' })
}

export function formatWeekdayLetters(locale = 'en-US'): string[] {
  return Array.from({ length: 7 }, (_, index) => (
    formatIsoDate(addDays('2026-01-04', index), locale, { weekday: 'narrow' })
  ))
}

/** Full human-readable date for visible ranges and screen-reader labels. */
export function formatFullDate(date: string, locale = 'en-US'): string {
  return formatIsoDate(date, locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatMonthDay(date: string, locale = 'en-US'): string {
  return formatIsoDate(date, locale, { month: 'long', day: 'numeric' })
}

export function formatAgendaHeading(date: string, locale = 'en-US'): string {
  return formatIsoDate(date, locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateRange(dateFrom: string, dateTo: string, locale = 'en-US'): string {
  const from = formatIsoDate(dateFrom, locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  if (dateFrom === dateTo) {
    return from
  }
  const to = formatIsoDate(dateTo, locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${from} – ${to}`
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
    cells.push({
      kind: 'day',
      date,
      dayNumber: day,
      dayOfWeek: dayOfWeekForDate(date),
    })
  }

  return cells
}

export function dateInRange(date: string, dateFrom: string, dateTo: string): boolean {
  return date >= dateFrom && date <= dateTo
}

export function rangesOverlap(
  firstFrom: string,
  firstTo: string,
  secondFrom: string,
  secondTo: string,
): boolean {
  return firstFrom <= secondTo && firstTo >= secondFrom
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
