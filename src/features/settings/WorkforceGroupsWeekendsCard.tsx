import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { type KeyboardEvent, useMemo, useState } from 'react'
import { getWorkforceGroups, putWorkforceGroupWeekendDays } from '../../api/client'
import type { DayOfWeek } from '../../api/generated/types'
import { useAuth } from '../../auth/useAuth'
import { PublicHolidaysSection } from './PublicHolidaysSection'
import { WeekendDayChips } from './WeekendDayChips'
import { WorkforceGroupModal } from './WorkforceGroupModal'
import { PlusIcon } from '../../components/ui/icons'
import './group-tabs.css'

type WorkforceGroupsWeekendsCardProps = {
  onSuccess?: (message: string) => void
  onWarning?: (message: string) => void
}

export function WorkforceGroupsWeekendsCard({
  onSuccess,
  onWarning,
}: WorkforceGroupsWeekendsCardProps) {
  const { t, i18n } = useTranslation('settings')
  const { user } = useAuth()
  const orgId = user?.organizationId
  const queryClient = useQueryClient()
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null)
  const [groupModalOpen, setGroupModalOpen] = useState(false)

  const queryKey = useMemo(() => ['workforce-groups', orgId] as const, [orgId])

  const groupsQuery = useQuery({
    queryKey,
    queryFn: getWorkforceGroups,
    enabled: orgId != null,
  })

  const groups = groupsQuery.data ?? []
  const resolvedActiveGroupId = activeGroupId ?? groups[0]?.id ?? null
  const activeGroup = groups.find((group) => group.id === resolvedActiveGroupId) ?? null

  const activateTab = (groupId: number) => {
    setActiveGroupId(groupId)
    const tab = document.getElementById(`workforce-group-tab-${groupId}`)
    tab?.focus()
    tab?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    const lastIndex = groups.length - 1
    let nextIndex: number | null = null

    if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = lastIndex
    } else {
      const forwardKey = i18n.dir() === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
      const backwardKey = i18n.dir() === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
      if (event.key === forwardKey) {
        nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1
      } else if (event.key === backwardKey) {
        nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1
      }
    }

    if (nextIndex == null) {
      return
    }

    event.preventDefault()
    activateTab(groups[nextIndex].id)
  }

  const updateWeekendsMutation = useMutation({
    mutationFn: ({
      groupId,
      weekendDays,
    }: {
      groupId: number
      weekendDays: DayOfWeek[]
    }) => putWorkforceGroupWeekendDays(groupId, weekendDays),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey })
      onSuccess?.(t('groups.updated', { name: updated.name }))
    },
    onError: () => {
      onWarning?.(t('groups.errors.updateWeekend'))
    },
  })

  if (groupsQuery.isPending) {
    return <p className="settings-card-loading" role="status">{t('groups.loading')}</p>
  }

  if (groupsQuery.isError) {
    return <p className="settings-card-error" role="alert">{t('groups.errors.load')}</p>
  }

  if (groups.length === 0) {
    return <p className="settings-card-loading" role="status">{t('groups.none')}</p>
  }

  return (
    <section className="settings-card" data-testid="workforce-groups-weekends-card">
      <div className="card-section-header">
        <span className="card-section-title">{t('groups.title')}</span>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          data-testid="add-group-btn"
          onClick={() => setGroupModalOpen(true)}
        >
          <PlusIcon size={14} /> {t('groups.actions.add')}
        </button>
      </div>

      <p className="settings-card-helper">
        {t('groups.helper')}
      </p>

      <div
        className="group-tabs"
        role="tablist"
        aria-label={t('groups.aria.list')}
        aria-orientation="horizontal"
      >
        {groups.map((group, index) => (
          <button
            key={group.id}
            id={`workforce-group-tab-${group.id}`}
            type="button"
            role="tab"
            aria-selected={group.id === resolvedActiveGroupId}
            aria-controls="workforce-group-panel"
            tabIndex={group.id === resolvedActiveGroupId ? 0 : -1}
            className={`group-tab${group.id === resolvedActiveGroupId ? ' active' : ''}`}
            onClick={() => setActiveGroupId(group.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {group.name}
          </button>
        ))}
      </div>

      {activeGroup && (
        <div
          id="workforce-group-panel"
          className="settings-card-body"
          role="tabpanel"
          aria-labelledby={`workforce-group-tab-${activeGroup.id}`}
        >
          <div className="settings-col settings-col-weekends">
            <p className="settings-card-label">
              {t('groups.weekendLabel')} <span>{activeGroup.name}</span>
            </p>
            <WeekendDayChips
              groupName={activeGroup.name}
              weekendDays={activeGroup.weekendDays}
              disabled={updateWeekendsMutation.isPending}
              onBlockedDeselect={() =>
                onWarning?.(t('groups.selectWeekend'))
              }
              onChange={async (weekendDays) => {
                await updateWeekendsMutation.mutateAsync({
                  groupId: activeGroup.id,
                  weekendDays,
                })
              }}
            />
          </div>
          <PublicHolidaysSection
            activeGroupId={activeGroup.id}
            activeGroupName={activeGroup.name}
            onSuccess={onSuccess}
            onWarning={onWarning}
          />
        </div>
      )}

      {groupModalOpen && (
        <WorkforceGroupModal
          onClose={() => setGroupModalOpen(false)}
          onSuccess={(message, newGroupId) => {
            void queryClient.invalidateQueries({ queryKey })
            setActiveGroupId(newGroupId)
            onSuccess?.(message)
          }}
          onWarning={onWarning}
        />
      )}
    </section>
  )
}
