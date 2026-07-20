import type { CSSProperties, ReactNode } from 'react'
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
  const resolvedTitle = title ?? `${absence.userFullName} — ${absence.leaveTypeName} (${range})`
  const resolvedAccessibleName = accessibleName
    ?? `${absence.userFullName}, ${absence.leaveTypeName}, ${range}`
  const content = children ?? absence.userInitials

  if (absence.canViewRequestContext) {
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
