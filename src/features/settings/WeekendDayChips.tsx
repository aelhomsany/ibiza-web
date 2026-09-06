import { useTranslation } from 'react-i18next'
import type { DayOfWeek } from '../../api/generated/types'
import { WEEKEND_DAYS_DISPLAY } from './weekendDays'
import './weekend-day-chips.css'

type WeekendDayChipsProps = {
  /** Names the group in each chip's accessible name; omit for a pattern that has no group yet. */
  groupName?: string
  weekendDays: DayOfWeek[]
  disabled?: boolean
  onChange: (weekendDays: DayOfWeek[]) => void
}

export function WeekendDayChips({
  groupName,
  weekendDays,
  disabled = false,
  onChange,
}: WeekendDayChipsProps) {
  const { t } = useTranslation('settings')

  return (
    <div className="weekend-chips" data-testid="weekend-chips">
      {WEEKEND_DAYS_DISPLAY.map(({ value }) => {
        const label = t(`days.${value}`)
        const isActive = weekendDays.includes(value)
        return (
          <label
            key={value}
            className={`weekend-chip${isActive ? ' active' : ''}${disabled ? ' disabled' : ''}`}
          >
            <input
              type="checkbox"
              checked={isActive}
              disabled={disabled}
              aria-label={
                groupName
                  ? t('groups.aria.weekendDayFor', { day: label, name: groupName })
                  : t('groups.aria.weekendDay', { day: label })
              }
              onChange={(event) => {
                const next = event.target.checked
                  ? [...weekendDays, value]
                  : weekendDays.filter((day) => day !== value)
                onChange(next)
              }}
            />
            {label}
          </label>
        )
      })}
    </div>
  )
}
