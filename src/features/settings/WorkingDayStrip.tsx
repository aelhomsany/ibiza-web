import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

/* Sunday-first, matching the design canvas. */
const WEEK_ORDER = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const

/* 2024-01-07 was a Sunday; the six days after it complete one week. */
const REFERENCE_SUNDAY_UTC = Date.UTC(2024, 0, 7)
const DAY_MS = 24 * 60 * 60 * 1000

type Props = {
  /** DayOfWeek names that are worked, e.g. ['MONDAY', 'TUESDAY']. */
  workingDays: readonly string[]
  /** The same information as a sentence, for anyone not looking at the strip. */
  label: string
}

/**
 * A schedule's working days as seven fixed cells rather than a middot-joined sentence.
 * The strip answers "does this group work Fridays?" by shape, so two schedules can be
 * compared without reading either one.
 *
 * The letters come from Intl rather than settings:days.* because those are three-letter
 * abbreviations, and their Arabic forms mostly begin with the same character — الأحد,
 * الاثنين and الأربعاء would all render as "ا". Intl's narrow weekday gives each locale
 * its own distinct initials.
 */
export function WorkingDayStrip({ workingDays, label }: Props) {
  const { i18n } = useTranslation()

  const initials = useMemo(() => {
    const format = new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow', timeZone: 'UTC' })
    return WEEK_ORDER.map((_, index) => format.format(new Date(REFERENCE_SUNDAY_UTC + index * DAY_MS)))
  }, [i18n.language])

  const worked = new Set(workingDays)

  return (
    <>
      {/* The strip is a picture of the sentence beside it, so it is not announced twice. */}
      <span className="day-strip" aria-hidden="true">
        {WEEK_ORDER.map((day, index) => (
          <span key={day} className={`day-strip-day${worked.has(day) ? ' is-working' : ''}`}>
            {initials[index]}
          </span>
        ))}
      </span>
      <span className="sr-only">{label}</span>
    </>
  )
}
