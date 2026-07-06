import type { CalendarAbsenceResponse } from '../../api/generated/types'
import { Link } from 'react-router-dom'
import { formatDate } from '../dashboard/leaveRequestFormatting'
import { userColorClass } from './calendarMonthUtils'

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
  const className = `cal-event ${userColorClass('cal-event', absence.userColorKey)} cal-event--${presence}`
  const title = `${absence.userFullName} - ${absence.leaveTypeName} (${absence.presence})`
  const dateCopy =
    absence.dateFrom === absence.dateTo
      ? `on ${formatDate(absence.dateFrom)}`
      : `from ${formatDate(absence.dateFrom)} to ${formatDate(absence.dateTo)}`
  const accessibleName =
    `Open request context for ${absence.userFullName} ${absence.leaveTypeName} ${dateCopy}`

  if (absence.canViewRequestContext) {
    return (
      <Link
        className={`${className} cal-event--interactive`}
        data-testid={testId}
        title={title}
        aria-label={accessibleName}
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
    >
      {absence.userInitials}
    </span>
  )
}
