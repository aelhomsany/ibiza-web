import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DayOfWeek } from '../../api/generated/types'
import { WEEKEND_DAYS_DISPLAY } from './weekendDays'
import './weekend-day-chips.css'

type WeekendDayChipsProps = {
  groupName: string
  weekendDays: DayOfWeek[]
  disabled?: boolean
  onChange: (weekendDays: DayOfWeek[]) => Promise<void>
  onBlockedDeselect?: () => void
}

export function WeekendDayChips({
  groupName,
  weekendDays,
  disabled = false,
  onChange,
  onBlockedDeselect,
}: WeekendDayChipsProps) {
  const { t } = useTranslation('settings')
  const [selected, setSelected] = useState<DayOfWeek[]>(weekendDays)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSelected(weekendDays)
  }, [weekendDays])

  const handleToggle = useCallback(
    async (day: DayOfWeek, checked: boolean) => {
      if (disabled || saving) {
        return
      }

      const next = checked
        ? [...selected, day]
        : selected.filter((value) => value !== day)

      if (next.length === 0) {
        onBlockedDeselect?.()
        return
      }

      const previous = selected
      setSelected(next)
      setSaving(true)

      try {
        await onChange(next)
      } catch {
        setSelected(previous)
      } finally {
        setSaving(false)
      }
    },
    [disabled, onBlockedDeselect, onChange, saving, selected],
  )

  return (
    <div className="weekend-chips" data-testid="weekend-chips">
      {WEEKEND_DAYS_DISPLAY.map(({ value }) => {
        const label = t(`days.${value}`)
        const isActive = selected.includes(value)
        return (
          <label
            key={value}
            className={`weekend-chip${isActive ? ' active' : ''}${disabled || saving ? ' disabled' : ''}`}
          >
            <input
              type="checkbox"
              checked={isActive}
              disabled={disabled || saving}
              data-busy={saving ? 'true' : undefined}
              aria-label={t('groups.aria.weekendDayFor', { day: label, name: groupName })}
              onChange={(event) => {
                void handleToggle(value, event.target.checked)
              }}
            />
            {label}
          </label>
        )
      })}
    </div>
  )
}
