import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { createWorkforceGroup, putWorkforceGroupWeekendDays } from '../../api/client'
import type { DayOfWeek } from '../../api/generated/types'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'
import { WEEKEND_DAYS_DISPLAY } from './weekendDays'
import './team-members.css'
import './weekend-day-chips.css'

type WorkforceGroupModalProps = {
  onClose: () => void
  onSuccess: (message: string, newGroupId: number) => void
  onWarning?: (message: string) => void
}

const DEFAULT_WEEKEND_DAYS: DayOfWeek[] = ['FRIDAY', 'SATURDAY']

export function WorkforceGroupModal({ onClose, onSuccess, onWarning }: WorkforceGroupModalProps) {
  const { t } = useTranslation(['settings', 'common'])
  const [name, setName] = useState('')
  const [weekendDays, setWeekendDays] = useState<DayOfWeek[]>(DEFAULT_WEEKEND_DAYS)
  const [submitting, setSubmitting] = useState(false)

  function toggleWeekendDay(day: DayOfWeek, checked: boolean) {
    const next = checked
      ? [...weekendDays, day]
      : weekendDays.filter((value) => value !== day)

    if (next.length === 0) {
      onWarning?.(t('settings:groups.selectWeekend'))
      return
    }

    setWeekendDays(next)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    if (weekendDays.length === 0) {
      onWarning?.(t('settings:groups.selectWeekend'))
      return
    }

    setSubmitting(true)
    try {
      const created = await createWorkforceGroup({ name: trimmedName })
      if (!created.id) {
        onWarning?.(t('settings:groups.errors.create'))
        return
      }
      const groupId = created.id
      try {
        await putWorkforceGroupWeekendDays(groupId, weekendDays)
        onSuccess(t('settings:groups.created', { name: trimmedName }), groupId)
      } catch {
        onSuccess(t('settings:groups.createdPartial'), groupId)
        onWarning?.(t('settings:groups.errors.saveWeekend'))
      }
      onClose()
    } catch {
      onWarning?.(t('settings:groups.errors.create'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal labelledBy="group-modal-title" onClose={onClose} testId="workforce-group-modal">
        <div className="modal-header">
          <span className="modal-title" id="group-modal-title">
            {t('settings:groups.modalTitle')}
          </span>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('common:actions.close')}>
            <CloseIcon size={18} />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="form-group">
            <label htmlFor="group-name">{t('settings:groups.groupName')}</label>
            <input
              id="group-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('settings:groups.namePlaceholder')}
              required
            />
          </div>

          <div className="form-group">
            <label>{t('settings:groups.defaultWeekend')}</label>
            <div className="weekend-chips">
              {WEEKEND_DAYS_DISPLAY.map(({ value }) => {
                const label = t(`settings:days.${value}`)
                const isActive = weekendDays.includes(value)
                return (
                  <label
                    key={value}
                    className={`weekend-chip${isActive ? ' active' : ''}${submitting ? ' disabled' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      disabled={submitting}
                      aria-label={t('settings:groups.aria.weekendDay', { day: label })}
                      onChange={(event) => toggleWeekendDay(value, event.target.checked)}
                    />
                    {label}
                  </label>
                )
              })}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
              {t('common:actions.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              data-testid="create-group-submit"
              disabled={submitting || name.trim().length === 0}
            >
              {t('settings:groups.actions.create')}
            </button>
          </div>
        </form>
    </Modal>
  )
}
