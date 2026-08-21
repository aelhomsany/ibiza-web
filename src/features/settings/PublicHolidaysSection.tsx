import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isolate } from '../../i18n/bidi'
import {
  createPublicHoliday,
  deletePublicHoliday,
  getPublicHolidays,
  updatePublicHoliday,
} from '../../api/client'
import type { PublicHolidayResponse } from '../../api/generated/types'
import { DateField } from '../../components/DateField'
import { useAuth } from '../../auth/useAuth'
import './public-holidays.css'

type PublicHolidaysSectionProps = {
  activeGroupId: number
  activeGroupName: string
  discardSignal?: number
  onDirtyChange?: (dirty: boolean) => void
  onSuccess?: (message: string) => void
  onWarning?: (message: string) => void
}

function formatHolidayDate(isoDate: string, locale: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatHolidayRange(dateFrom: string, dateTo: string, locale: string): string {
  if (!dateTo || dateTo === dateFrom) {
    return formatHolidayDate(dateFrom, locale)
  }
  return `${formatHolidayDate(dateFrom, locale)} – ${formatHolidayDate(dateTo, locale)}`
}

export function PublicHolidaysSection({
  activeGroupId,
  activeGroupName,
  discardSignal = 0,
  onDirtyChange,
  onSuccess,
  onWarning,
}: PublicHolidaysSectionProps) {
  const { t, i18n } = useTranslation(['settings', 'common'])
  const { user } = useAuth()
  const orgId = user?.organizationId
  const queryClient = useQueryClient()
  const [newDateFrom, setNewDateFrom] = useState('')
  const [newDateTo, setNewDateTo] = useState('')
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDateFrom, setEditDateFrom] = useState('')
  const [editDateTo, setEditDateTo] = useState('')
  const [editName, setEditName] = useState('')

  const queryKey = useMemo(
    () => ['public-holidays', orgId, activeGroupId] as const,
    [orgId, activeGroupId],
  )

  const holidaysQuery = useQuery({
    queryKey,
    queryFn: () => getPublicHolidays(activeGroupId),
    enabled: orgId != null,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey })
  }

  const holidays = holidaysQuery.data ?? []
  const editingHoliday =
    editingId != null ? holidays.find((holiday) => holiday.id === editingId) ?? null : null
  // Opening Edit alone isn't a change — only count it dirty once a field
  // actually differs from the holiday's saved values (mirrors
  // WorkforceGroupsWeekendsCard's sameWeekendDays before/after comparison).
  const isEditDirty =
    editingId != null &&
    (editingHoliday != null
      ? editDateFrom !== editingHoliday.dateFrom ||
        editDateTo !== (editingHoliday.dateTo || editingHoliday.dateFrom) ||
        editName.trim() !== editingHoliday.name
      : // The edited row vanished (e.g. a background refetch dropped it) while an
        // edit was open — keep the guard armed if the user had typed anything,
        // so their unsaved text isn't silently lost.
        Boolean(editDateFrom || editDateTo || editName.trim()))
  const isDirty = Boolean(newDateFrom || newDateTo || newName.trim()) || isEditDirty

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  // Clear any in-progress add/edit on an explicit discard AND whenever the
  // active Workforce Group changes, so a stale edit row / typed new-holiday
  // text from the previous group doesn't carry over to the next group.
  useEffect(() => {
    setNewDateFrom('')
    setNewDateTo('')
    setNewName('')
    setEditingId(null)
    setEditDateFrom('')
    setEditDateTo('')
    setEditName('')
  }, [discardSignal, activeGroupId])

  const createMutation = useMutation({
    mutationFn: createPublicHoliday,
    onSuccess: () => {
      invalidate()
      setNewDateFrom('')
      setNewDateTo('')
      setNewName('')
      onSuccess?.(t('settings:holidays.success.added', { name: isolate(activeGroupName) }))
    },
    onError: () => onWarning?.(t('settings:holidays.errors.add')),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      dateFrom,
      dateTo,
      name,
    }: {
      id: number
      dateFrom: string
      dateTo: string
      name: string
    }) => updatePublicHoliday(id, { dateFrom, dateTo, name }),
    onSuccess: (updated) => {
      invalidate()
      setEditingId(null)
      onSuccess?.(t('settings:holidays.success.updated', { name: isolate(updated.name) }))
    },
    onError: () => onWarning?.(t('settings:holidays.errors.update')),
  })

  const deleteMutation = useMutation({
    mutationFn: deletePublicHoliday,
    onSuccess: () => {
      invalidate()
      onSuccess?.(t('settings:holidays.success.removed'))
    },
    onError: () => onWarning?.(t('settings:holidays.errors.remove')),
  })

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending

  const startEdit = (holiday: PublicHolidayResponse) => {
    setEditingId(holiday.id)
    setEditDateFrom(holiday.dateFrom)
    setEditDateTo(holiday.dateTo)
    setEditName(holiday.name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDateFrom('')
    setEditDateTo('')
    setEditName('')
  }

  const handleAdd = async () => {
    const trimmedName = newName.trim()
    if (!newDateFrom || !trimmedName) {
      onWarning?.(t('settings:holidays.errors.required'))
      return
    }
    const dateTo = newDateTo || newDateFrom
    if (dateTo < newDateFrom) {
      onWarning?.(t('settings:holidays.errors.dateRange'))
      return
    }
    await createMutation.mutateAsync({
      workforceGroupId: activeGroupId,
      dateFrom: newDateFrom,
      dateTo,
      name: trimmedName,
    })
  }

  const handleSaveEdit = async (id: number) => {
    const trimmedName = editName.trim()
    if (!editDateFrom || !trimmedName) {
      onWarning?.(t('settings:holidays.errors.required'))
      return
    }
    const dateTo = editDateTo || editDateFrom
    if (dateTo < editDateFrom) {
      onWarning?.(t('settings:holidays.errors.dateRange'))
      return
    }
    await updateMutation.mutateAsync({
      id,
      dateFrom: editDateFrom,
      dateTo,
      name: trimmedName,
    })
  }

  if (holidaysQuery.isPending) {
    return <p className="settings-card-loading" role="status">{t('settings:holidays.loading')}</p>
  }

  if (holidaysQuery.isError) {
    return <p className="settings-card-error" role="alert">{t('settings:holidays.errors.load')}</p>
  }

  return (
    <section className="public-holidays-section" data-testid="public-holidays-section">
      <p className="public-holidays-label">
        {t('settings:holidays.title')} <span>{activeGroupName}</span>
      </p>

      {holidays.length === 0 && (
        <div className="public-holidays-empty" role="status">
          {t('settings:holidays.none')}
        </div>
      )}

      {holidays.length > 0 && (
        <div className="holiday-grid">
          {holidays.map((holiday) =>
            editingId === holiday.id ? (
              <div key={holiday.id} className="holiday-card holiday-card-edit">
                <label className="holiday-date-field">
                  <span>{t('settings:holidays.fields.from')}</span>
                  <DateField
                    value={editDateFrom}
                    onChange={setEditDateFrom}
                    aria-label={t('settings:holidays.aria.editStart', { name: holiday.name })}
                    disabled={isSaving}
                  />
                </label>
                <label className="holiday-date-field">
                  <span>{t('settings:holidays.fields.to')}</span>
                  <DateField
                    value={editDateTo}
                    min={editDateFrom || undefined}
                    onChange={setEditDateTo}
                    aria-label={t('settings:holidays.aria.editEnd', { name: holiday.name })}
                    disabled={isSaving}
                  />
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  aria-label={t('settings:holidays.aria.editName', { name: holiday.name })}
                  disabled={isSaving}
                />
                <div className="holiday-card-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void handleSaveEdit(holiday.id)}
                    disabled={isSaving}
                    data-busy={isSaving ? 'true' : undefined}
                  >
                    {t('common:actions.save')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={cancelEdit}
                    disabled={isSaving}
                  >
                    {t('common:actions.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <div key={holiday.id} className="holiday-card">
                <div className="holiday-card-body">
                  <span className="holiday-card-name" dir="auto" title={holiday.name}>
                    {holiday.name}
                  </span>
                  <span className="holiday-card-date">
                    {formatHolidayRange(holiday.dateFrom, holiday.dateTo, i18n.language)}
                  </span>
                </div>
                <div className="holiday-card-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => startEdit(holiday)}
                    disabled={isSaving}
                    aria-label={t('settings:holidays.aria.editAction', { name: holiday.name })}
                  >
                    {t('common:actions.edit')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void deleteMutation.mutateAsync(holiday.id)}
                    disabled={isSaving}
                    data-busy={isSaving ? 'true' : undefined}
                    aria-label={t('settings:holidays.aria.removeAction', { name: holiday.name })}
                  >
                    {t('settings:holidays.actions.remove')}
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      <div className="holiday-add">
        <label className="holiday-date-field">
          <span>{t('settings:holidays.fields.from')}</span>
          <DateField
            className="holiday-add-date"
            value={newDateFrom}
            onChange={setNewDateFrom}
            aria-label={t('settings:holidays.aria.newStart', { name: activeGroupName })}
            disabled={isSaving}
          />
        </label>
        <label className="holiday-date-field">
          <span>{t('settings:holidays.fields.to')}</span>
          <DateField
            className="holiday-add-date"
            value={newDateTo}
            min={newDateFrom || undefined}
            onChange={setNewDateTo}
            aria-label={t('settings:holidays.aria.newEnd', { name: activeGroupName })}
            disabled={isSaving}
          />
        </label>
        <input
          type="text"
          className="holiday-add-name"
          value={newName}
          placeholder={t('settings:holidays.fields.name')}
          onChange={(e) => setNewName(e.target.value)}
          aria-label={t('settings:holidays.aria.newName', { name: activeGroupName })}
          disabled={isSaving}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void handleAdd()}
          disabled={isSaving}
          data-busy={isSaving ? 'true' : undefined}
        >
          {t('settings:holidays.actions.add')}
        </button>
      </div>
    </section>
  )
}
