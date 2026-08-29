import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { CalendarAbsenceResponse } from '../../api/generated/types'
import { chipColorStyle } from '../../utils/entityColor'
import { formatDateRange } from './calendarMonthUtils'

type CalendarEventChipProps = {
  absence: CalendarAbsenceResponse
  date?: string
  className?: string
  testId?: string
  title?: string
  accessibleName?: string
  style?: CSSProperties
  children?: ReactNode
}

export function CalendarEventChip({
  absence,
  date,
  className = 'cal-event',
  testId,
  title,
  accessibleName,
  style,
  children,
}: CalendarEventChipProps) {
  const { t } = useTranslation('calendar')
  const isSingleDay = absence.dateFrom === absence.dateTo
  const resolvedTestId = testId ?? (
    isSingleDay || date == null
      ? `calendar-event-${absence.requestId}`
      : `calendar-event-${absence.requestId}-${date}`
  )
  const presence = absence.presence.toLowerCase()
  const resolvedClassName = `${className} cal-event--${presence}`
  const colorStyle = {
    ...chipColorStyle(absence.userId),
    ...style,
  } as CSSProperties
  const range = formatDateRange(absence.dateFrom, absence.dateTo)
  // Story 16.2: identity and Leave Type are privacy-projected and may be absent. Template
  // literals happily interpolate `undefined` — TypeScript will not stop them — so every read
  // goes through a localized fallback. A chip that says "undefined" is a redaction bug the
  // user sees.
  const personLabel = absence.userFullName ?? t('redacted.person')
  const leaveTypeLabel = absence.leaveTypeName ?? t('redacted.leaveType')
  const resolvedTitle = title ?? `${personLabel} — ${leaveTypeLabel} (${range})`
  const resolvedAccessibleName = accessibleName
    ?? `${personLabel}, ${leaveTypeLabel}, ${range}`
  const content = children ?? absence.userInitials ?? '?'

  if (absence.canViewRequestContext === true) {
    return (
      <Link
        className={`${resolvedClassName} cal-event--interactive`}
        data-testid={resolvedTestId}
        title={resolvedTitle}
        aria-label={resolvedAccessibleName}
        style={colorStyle}
        to={`/leave-requests/${absence.requestId}`}
      >
        {content}
      </Link>
    )
  }

  return (
    <span
      className={resolvedClassName}
      data-testid={resolvedTestId}
      title={resolvedTitle}
      role="group"
      aria-label={resolvedAccessibleName}
      style={colorStyle}
    >
      {content}
    </span>
  )
}
