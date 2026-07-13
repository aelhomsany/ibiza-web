import type { CSSProperties } from 'react'
import type { CalendarAbsenceResponse } from '../../api/generated/types'
import { Link } from 'react-router-dom'
import { chipColorStyle } from '../../utils/entityColor'
import { formatDate } from '../dashboard/leaveRequestFormatting'

type CalendarEventChipProps = {
  absence: CalendarAbsenceResponse
  date: string
}

export function CalendarEventChip({ absence, date }: CalendarEventChipProps) {
  const isSingleDay = absence.dateFrom === absence.dateTo
  const testId = isSingleDay
    ? `calendar-event-${absence.requestId}`
    : `calendar-event-${absence.requestId}-${date}`
  const presence = absence.presence.toLowerCase()
  const className = `cal-event cal-event--${presence}`
  const colorStyle = chipColorStyle(absence.userId) as CSSProperties
  const title = `${absence.userFullName} - ${absence.leaveTypeName} (${absence.presence})`
  const dateCopy =
    absence.dateFrom === absence.dateTo
      ? `on ${formatDate(absence.dateFrom)}`
      : `from ${formatDate(absence.dateFrom)} to ${formatDate(absence.dateTo)}`
  const accessibleName =
    `Open request context for ${absence.userFullName} ${absence.leaveTypeName} ${dateCopy}`

  const informationalName = `${absence.userFullName}, ${absence.leaveTypeName}, ${dateCopy}`

  if (absence.canViewRequestContext) {
    return (
      <Link
        className={`${className} cal-event--interactive`}
        data-testid={testId}
        title={title}
        aria-label={accessibleName}
        style={colorStyle}
        to={`/leave-requests/${absence.requestId}`}
      >
        {absence.userInitials}
      </Link>
    )
  }

  return (
    <span
      className={className}
      data-testid={testId}
      title={title}
      aria-label={informationalName}
      style={colorStyle}
    >
      {absence.userInitials}
    </span>
  )
}
