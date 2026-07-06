import { useState, type FormEvent } from 'react'
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
  const [name, setName] = useState('')
  const [weekendDays, setWeekendDays] = useState<DayOfWeek[]>(DEFAULT_WEEKEND_DAYS)
  const [submitting, setSubmitting] = useState(false)

  function toggleWeekendDay(day: DayOfWeek, checked: boolean) {
    const next = checked
      ? [...weekendDays, day]
      : weekendDays.filter((value) => value !== day)

    if (next.length === 0) {
      onWarning?.('Select at least one weekend day')
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
      onWarning?.('Select at least one weekend day')
      return
    }

    setSubmitting(true)
    try {
      const created = await createWorkforceGroup({ name: trimmedName })
      if (!created.id) {
        onWarning?.('Failed to create workforce group')
        return
      }
      const groupId = created.id
      try {
        await putWorkforceGroupWeekendDays(groupId, weekendDays)
        onSuccess(`Workforce Group "${trimmedName}" created`, groupId)
      } catch {
        onSuccess('Group created — open the new tab to update weekend days', groupId)
        onWarning?.('Weekend days could not be saved. Update them from the new tab.')
      }
      onClose()
    } catch {
      onWarning?.('Failed to create workforce group')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal labelledBy="group-modal-title" onClose={onClose} testId="workforce-group-modal">
        <div className="modal-header">
          <span className="modal-title" id="group-modal-title">
            Add Workforce Group
          </span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="form-group">
            <label htmlFor="group-name">Group name</label>
            <input
              id="group-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. UK"
              required
            />
          </div>

          <div className="form-group">
            <label>Default weekend days</label>
            <div className="weekend-chips">
              {WEEKEND_DAYS_DISPLAY.map(({ label, value }) => {
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
                      aria-label={`${label} weekend day`}
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
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              data-testid="create-group-submit"
              disabled={submitting || name.trim().length === 0}
            >
              Create Group
            </button>
          </div>
        </form>
    </Modal>
  )
}
