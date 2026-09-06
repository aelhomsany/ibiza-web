import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { isolate } from '../../i18n/bidi'
import { createWorkforceGroup } from '../../api/client'
import type { DayOfWeek } from '../../api/generated/types'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'
import { availableTimezones } from '../../lib/timezones'
import { WeekendDayChips } from './WeekendDayChips'
import './team-members.css'
import './weekend-day-chips.css'

type WorkforceGroupModalProps = {
  /**
   * True when the organization has no Workforce Groups yet. Tenants are provisioned with none, so
   * this is the founding Organization Admin's first calendar: the server adopts every still-ungrouped user
   * into it, and the copy says so instead of the neutral "group created".
   */
  isFirstGroup?: boolean
  /** Pre-selected zone: the organization's operational zone, which is also the server default. */
  defaultTimezone: string
  onClose: () => void
  onSuccess: (message: string, newGroupId: number) => void
  onWarning?: (message: string) => void
}

const DEFAULT_WEEKEND_DAYS: DayOfWeek[] = ['FRIDAY', 'SATURDAY']

/**
 * Plan UNO: a group is created in one request carrying its name, time zone and weekend pattern,
 * so there is no half-created group whose weekend save failed after the name was taken.
 */
export function WorkforceGroupModal({
  isFirstGroup = false,
  defaultTimezone,
  onClose,
  onSuccess,
  onWarning,
}: WorkforceGroupModalProps) {
  const { t } = useTranslation(['settings', 'common'])
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState(defaultTimezone)
  const [weekendDays, setWeekendDays] = useState<DayOfWeek[]>(DEFAULT_WEEKEND_DAYS)
  const [submitting, setSubmitting] = useState(false)
  const timezoneOptions = useMemo(() => availableTimezones(defaultTimezone), [defaultTimezone])

  function changeWeekendDays(next: DayOfWeek[]) {
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
      const created = await createWorkforceGroup({ name: trimmedName, timezone, weekendDays })
      if (!created.id) {
        onWarning?.(t('settings:groups.errors.create'))
        return
      }
      onSuccess(
        t(
          isFirstGroup ? 'settings:groups.createdFirst' : 'settings:groups.created',
          { name: isolate(trimmedName) },
        ),
        created.id,
      )
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
            {isFirstGroup ? t('settings:groups.firstModalTitle') : t('settings:groups.modalTitle')}
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
            <label htmlFor="group-timezone">{t('settings:groups.timezone.label')}</label>
            <select
              id="group-timezone"
              data-testid="group-timezone"
              value={timezone}
              disabled={submitting}
              onChange={(event) => setTimezone(event.target.value)}
            >
              {timezoneOptions.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
            <p className="form-hint">{t('settings:groups.timezone.defaultHint')}</p>
          </div>

          <div className="form-group">
            <label>{t('settings:groups.defaultWeekend')}</label>
            <WeekendDayChips
              weekendDays={weekendDays}
              disabled={submitting}
              onChange={changeWeekendDays}
            />
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
