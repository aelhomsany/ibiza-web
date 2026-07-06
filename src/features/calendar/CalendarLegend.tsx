import type { CalendarAbsenceResponse, CalendarHolidayResponse } from '../../api/generated/types'
import { groupPillClass } from '../../components/groupPillClass'
import { firstName, uniqueBy, userColorClass } from './calendarMonthUtils'

type CalendarLegendProps = {
  absences: CalendarAbsenceResponse[]
  holidays: CalendarHolidayResponse[]
}

export function CalendarLegend({ absences, holidays }: CalendarLegendProps) {
  const users = uniqueBy(absences, (absence) => absence.userId)
  const holidayGroups = uniqueBy(holidays, (holiday) => holiday.workforceGroupId)

  return (
    <div className="cal-legend" aria-label="Calendar legend">
      <span className="cal-legend-item">
        <span className="cal-event cal-event--sample cal-event--off">AA</span>
        <span>Off</span>
      </span>
      <span className="cal-legend-item">
        <span className="cal-event cal-event--sample cal-event--wfh">AA</span>
        <span>WFH</span>
      </span>
      <span className="cal-legend-item">
        <span className="cal-holiday-swatch" />
        <span>Holiday</span>
      </span>

      {users.map((absence) => (
        <span key={absence.userId} className="cal-legend-item">
          <span className={`cal-user-dot ${userColorClass('cal-user-dot', absence.userColorKey)}`} />
          <span>{firstName(absence.userFullName)}</span>
        </span>
      ))}

      {holidayGroups.map((holiday) => (
        <span key={holiday.workforceGroupId} className="cal-legend-item">
          <span className={groupPillClass(holiday.workforceGroupName)}>
            {holiday.workforceGroupName}
          </span>
          <span>holiday</span>
        </span>
      ))}
    </div>
  )
}
