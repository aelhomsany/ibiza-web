import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
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
  onSuccess?: (message: string) => void
  onWarning?: (message: string) => void
}

function formatHolidayDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatHolidayRange(dateFrom: string, dateTo: string): string {
  if (!dateTo || dateTo === dateFrom) {
    return formatHolidayDate(dateFrom)
  }
  return `${formatHolidayDate(dateFrom)} – ${formatHolidayDate(dateTo)}`
}

export function PublicHolidaysSection({
  activeGroupId,
  activeGroupName,
  onSuccess,
  onWarning,
}: PublicHolidaysSectionProps) {
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

  const createMutation = useMutation({
    mutationFn: createPublicHoliday,
    onSuccess: () => {
      invalidate()
      setNewDateFrom('')
      setNewDateTo('')
      setNewName('')
      onSuccess?.(`Holiday added to ${activeGroupName}`)
    },
    onError: () => onWarning?.('Failed to add holiday'),
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
      onSuccess?.(`${updated.name} updated`)
    },
    onError: () => onWarning?.('Failed to update holiday'),
  })

  const deleteMutation = useMutation({
    mutationFn: deletePublicHoliday,
    onSuccess: () => {
      invalidate()
      onSuccess?.('Holiday removed')
    },
    onError: () => onWarning?.('Failed to remove holiday'),
  })

  const holidays = holidaysQuery.data ?? []
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
      onWarning?.('Enter a start date and name')
      return
    }
    const dateTo = newDateTo || newDateFrom
    if (dateTo < newDateFrom) {
      onWarning?.('End date must be on or after start date')
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
      onWarning?.('Enter a start date and name')
      return
    }
    const dateTo = editDateTo || editDateFrom
    if (dateTo < editDateFrom) {
      onWarning?.('End date must be on or after start date')
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
    return <p className="settings-card-loading">Loading holidays…</p>
  }

  if (holidaysQuery.isError) {
    return <p className="settings-card-error">Unable to load holidays.</p>
  }

  return (
    <section className="public-holidays-section" data-testid="public-holidays-section">
      <p className="public-holidays-label">
        Public holidays — <span>{activeGroupName}</span>
      </p>

      {holidays.length === 0 && (
        <div className="public-holidays-empty">No holidays yet</div>
      )}

      {holidays.length > 0 && (
        <div className="holiday-grid">
          {holidays.map((holiday) =>
            editingId === holiday.id ? (
              <div key={holiday.id} className="holiday-card holiday-card-edit">
                <label className="holiday-date-field">
                  <span>From</span>
                  <DateField
                    value={editDateFrom}
                    onChange={setEditDateFrom}
                    aria-label={`Edit start date for ${holiday.name}`}
                    disabled={isSaving}
                  />
                </label>
                <label className="holiday-date-field">
                  <span>To</span>
                  <DateField
                    value={editDateTo}
                    min={editDateFrom || undefined}
                    onChange={setEditDateTo}
                    aria-label={`Edit end date for ${holiday.name}`}
                    disabled={isSaving}
                  />
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  aria-label={`Edit name for ${holiday.name}`}
                  disabled={isSaving}
                />
                <div className="holiday-card-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void handleSaveEdit(holiday.id)}
                    disabled={isSaving}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="holiday-btn-ghost"
                    onClick={cancelEdit}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div key={holiday.id} className="holiday-card">
                <div className="holiday-card-body">
                  <span className="holiday-card-name" title={holiday.name}>
                    {holiday.name}
                  </span>
                  <span className="holiday-card-date">
                    {formatHolidayRange(holiday.dateFrom, holiday.dateTo)}
                  </span>
                </div>
                <div className="holiday-card-actions">
                  <button
                    type="button"
                    className="holiday-btn-ghost"
                    onClick={() => startEdit(holiday)}
                    disabled={isSaving}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="holiday-btn-ghost"
                    onClick={() => void deleteMutation.mutateAsync(holiday.id)}
                    disabled={isSaving}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      <div className="holiday-add">
        <label className="holiday-date-field">
          <span>From</span>
          <DateField
            className="holiday-add-date"
            value={newDateFrom}
            onChange={setNewDateFrom}
            aria-label={`New holiday start date for ${activeGroupName}`}
            disabled={isSaving}
          />
        </label>
        <label className="holiday-date-field">
          <span>To</span>
          <DateField
            className="holiday-add-date"
            value={newDateTo}
            min={newDateFrom || undefined}
            onChange={setNewDateTo}
            aria-label={`New holiday end date for ${activeGroupName}`}
            disabled={isSaving}
          />
        </label>
        <input
          type="text"
          className="holiday-add-name"
          value={newName}
          placeholder="Holiday name"
          onChange={(e) => setNewName(e.target.value)}
          aria-label={`New holiday name for ${activeGroupName}`}
          disabled={isSaving}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void handleAdd()}
          disabled={isSaving}
        >
          Add
        </button>
      </div>
    </section>
  )
}
