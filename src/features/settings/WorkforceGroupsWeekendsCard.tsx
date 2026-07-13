import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
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
      onSuccess?.(`${updated.name} weekend days updated`)
    },
    onError: () => {
      onWarning?.('Failed to update weekend days')
    },
  })

  if (groupsQuery.isPending) {
    return <p className="settings-card-loading">Loading workforce groups…</p>
  }

  if (groupsQuery.isError) {
    return <p className="settings-card-error">Unable to load workforce groups.</p>
  }

  if (groups.length === 0) {
    return <p className="settings-card-loading">No workforce groups configured yet.</p>
  }

  return (
    <section className="settings-card" data-testid="workforce-groups-weekends-card">
      <div className="card-section-header">
        <span className="card-section-title">Workforce Groups</span>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          data-testid="add-group-btn"
          onClick={() => setGroupModalOpen(true)}
        >
          <PlusIcon size={14} /> Add Group
        </button>
      </div>

      <p className="settings-card-helper">
        Each group has its own weekends and holidays. Users are assigned to exactly one group.
      </p>

      <div className="group-tabs" role="tablist" aria-label="Workforce groups">
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={group.id === resolvedActiveGroupId}
            className={`group-tab${group.id === resolvedActiveGroupId ? ' active' : ''}`}
            onClick={() => setActiveGroupId(group.id)}
          >
            {group.name}
          </button>
        ))}
      </div>

      {activeGroup && (
        <div className="settings-card-body">
          <div className="settings-col settings-col-weekends">
            <p className="settings-card-label">
              Weekend days — <span>{activeGroup.name}</span>
            </p>
            <WeekendDayChips
              groupName={activeGroup.name}
              weekendDays={activeGroup.weekendDays}
              disabled={updateWeekendsMutation.isPending}
              onBlockedDeselect={() =>
                onWarning?.('Select at least one weekend day')
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
