import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { type KeyboardEvent, useEffect, useMemo, useState } from 'react'
import { getTeamMembers, getWorkforceGroups, putWorkforceGroupWeekendDays } from '../../api/client'
import type {
  DayOfWeek,
  WorkforceGroupResponse,
} from '../../api/generated/types'
import { useAuth } from '../../auth/useAuth'
import { PublicHolidaysSection } from './PublicHolidaysSection'
import { WeekendDayChips } from './WeekendDayChips'
import { WorkforceGroupModal } from './WorkforceGroupModal'
import { CheckCircleIcon, ChevronRightIcon, PlusIcon } from '../../components/ui/icons'
import { WEEKEND_DAYS_DISPLAY } from './weekendDays'
import './group-tabs.css'

type WorkforceGroupsWeekendsCardProps = {
  requestedGroupId?: number | null
  discardSignal?: number
  onDirtyChange?: (dirty: boolean) => void
  // Returns whether the switch applied immediately (true) or was deferred
  // behind the unsaved-changes modal (false).
  onRequestGroupChange?: (groupId: number) => boolean
  onResolvedGroupId?: (groupId: number) => void
  onSuccess?: (message: string) => void
  onWarning?: (message: string) => void
}

const DAY_ORDER = new Map(
  WEEKEND_DAYS_DISPLAY.map(({ value }, index) => [value, index]),
)

function normalizedWeekendDays(days: DayOfWeek[]) {
  return [...days].sort(
    (left, right) => (DAY_ORDER.get(left) ?? 0) - (DAY_ORDER.get(right) ?? 0),
  )
}

function sameWeekendDays(left: DayOfWeek[], right: DayOfWeek[]) {
  const normalizedLeft = normalizedWeekendDays(left)
  const normalizedRight = normalizedWeekendDays(right)
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((day, index) => day === normalizedRight[index])
  )
}

export function WorkforceGroupsWeekendsCard({
  requestedGroupId = null,
  discardSignal = 0,
  onDirtyChange,
  onRequestGroupChange,
  onResolvedGroupId,
  onSuccess,
  onWarning,
}: WorkforceGroupsWeekendsCardProps) {
  const { t, i18n } = useTranslation('settings')
  const { user } = useAuth()
  const orgId = user?.organizationId
  const queryClient = useQueryClient()
  const queryKey = useMemo(() => ['workforce-groups', orgId] as const, [orgId])
  const membersQueryKey = useMemo(() => ['team-members', orgId] as const, [orgId])

  const groupsQuery = useQuery({
    queryKey,
    queryFn: getWorkforceGroups,
    enabled: orgId != null,
  })

  const membersQuery = useQuery({
    queryKey: membersQueryKey,
    queryFn: getTeamMembers,
    enabled: orgId != null,
  })

  const [localActiveGroupId, setLocalActiveGroupId] = useState<number | null>(null)

  const groups = groupsQuery.data ?? []
  const selectedGroupId = requestedGroupId ?? localActiveGroupId
  const resolvedActiveGroupId = groups.some((group) => group.id === selectedGroupId)
    ? selectedGroupId
    : groups[0]?.id ?? null
  const activeGroup =
    groups.find((group) => group.id === resolvedActiveGroupId) ?? null

  const [groupModalOpen, setGroupModalOpen] = useState(false)
  // Lazy-init from any group already resolved on first render (e.g. a warm
  // React Query cache on remount), so the impact panel doesn't flash "select
  // a weekend day" for one frame before the sync effect below corrects it.
  const [draftWeekendDays, setDraftWeekendDays] = useState<DayOfWeek[]>(
    () => activeGroup?.weekendDays ?? [],
  )
  // Tracks which group `draftWeekendDays` actually reflects. Without this,
  // there's a one-render window — after `groupsQuery` first resolves but
  // before the sync effect below runs — where `draftWeekendDays` is still its
  // pre-load value for a *different* (or no) group, and comparing it against
  // the just-loaded `activeGroup.weekendDays` below would read as a false
  // "unsaved change" the user never made.
  const [syncedGroupId, setSyncedGroupId] = useState<number | null>(
    () => activeGroup?.id ?? null,
  )
  const [holidaysDirty, setHolidaysDirty] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')

  useEffect(() => {
    if (!activeGroup) {
      return
    }
    setDraftWeekendDays(activeGroup.weekendDays)
    setSyncedGroupId(activeGroup.id)
    setHolidaysDirty(false)
    setSavedMessage('')
    // Group identity is the reset boundary; a same-group refetch must not erase
    // an in-progress draft or the durable post-save status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup?.id])

  useEffect(() => {
    if (!activeGroup) {
      return
    }
    setDraftWeekendDays(activeGroup.weekendDays)
    setSyncedGroupId(activeGroup.id)
    setHolidaysDirty(false)
    setSavedMessage('')
    // This effect intentionally responds to the page-level discard signal. Server
    // refetches must not erase the durable save confirmation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discardSignal])

  useEffect(() => {
    // A holiday add/edit is a distinct action from the weekend save below —
    // don't let a stale "weekend pattern saved" banner keep showing while the
    // user is midway through unrelated holiday work in the same group.
    if (holidaysDirty) {
      setSavedMessage('')
    }
  }, [holidaysDirty])

  useEffect(() => {
    if (
      requestedGroupId != null &&
      resolvedActiveGroupId != null &&
      requestedGroupId !== resolvedActiveGroupId &&
      !groupsQuery.isFetching
    ) {
      onResolvedGroupId?.(resolvedActiveGroupId)
    }
  }, [
    groupsQuery.isFetching,
    onResolvedGroupId,
    requestedGroupId,
    resolvedActiveGroupId,
  ])

  const weekendDirty =
    activeGroup != null &&
    syncedGroupId === activeGroup.id &&
    !sameWeekendDays(draftWeekendDays, activeGroup.weekendDays)
  const isDirty = weekendDirty || holidaysDirty

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(
    () => () => {
      onDirtyChange?.(false)
    },
    [onDirtyChange],
  )

  const activeMemberCount = useMemo(() => {
    if (!activeGroup || !membersQuery.data) {
      return null
    }
    return membersQuery.data.filter(
      (member) =>
        member.workforceGroupId === activeGroup.id &&
        member.status !== 'DEACTIVATED',
    ).length
  }, [activeGroup, membersQuery.data])

  const countLabel = membersQuery.isPending
    ? t('groups.count.loading')
    : membersQuery.isError || activeMemberCount == null
      ? t('groups.count.unavailable')
      : t('groups.count.people', { count: activeMemberCount })

  const requestGroupChange = (groupId: number): boolean => {
    if (onRequestGroupChange) {
      return onRequestGroupChange(groupId)
    }
    setLocalActiveGroupId(groupId)
    return true
  }

  const activateTab = (groupId: number) => {
    const applied = requestGroupChange(groupId)
    if (!applied) {
      // A dirty draft deferred this behind the unsaved-changes modal — leave
      // focus where it is instead of desyncing it from the visible/ARIA
      // selection (the modal takes focus on its own once it opens).
      return
    }
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
      queryClient.setQueryData<WorkforceGroupResponse[]>(queryKey, (current) =>
        current?.map((group) => (group.id === updated.id ? updated : group)),
      )
      setDraftWeekendDays(updated.weekendDays)
      setSavedMessage(t('groups.savedStatus', { name: updated.name }))
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

  const localizedWeekendDays = draftWeekendDays.map((day) => t(`days.${day}`))
  const weekendList = new Intl.ListFormat(i18n.language, {
    style: 'long',
    type: 'conjunction',
  }).format(localizedWeekendDays)

  return (
    <section className="settings-card" data-testid="workforce-groups-weekends-card">
      <div className="card-section-header working-calendars-card-header">
        <div>
          <span className="card-section-title">{t('groups.title')}</span>
          <p className="settings-card-helper">{t('groups.helper')}</p>
        </div>
        <details className="settings-disclosure">
          <summary>
            {t('groups.actions.manage')}
            <ChevronRightIcon
              size={14}
              className="settings-disclosure-chevron"
              aria-hidden="true"
            />
          </summary>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            data-testid="add-group-btn"
            onClick={() => setGroupModalOpen(true)}
          >
            <PlusIcon size={14} /> {t('groups.actions.add')}
          </button>
        </details>
      </div>

      <div
        className="group-tabs"
        role="tablist"
        aria-label={t('groups.aria.list')}
        aria-orientation="horizontal"
      >
        {groups.map((group, index) => {
          const groupCount = membersQuery.data?.filter(
            (member) =>
              member.workforceGroupId === group.id &&
              member.status !== 'DEACTIVATED',
          ).length
          const groupCountLabel = membersQuery.isPending
            ? t('groups.count.shortLoading')
            : membersQuery.isError || groupCount == null
              ? t('groups.count.shortUnavailable')
              : t('groups.count.short', { count: groupCount })
          return (
            <button
              key={group.id}
              id={`workforce-group-tab-${group.id}`}
              type="button"
              role="tab"
              aria-label={group.name}
              aria-selected={group.id === resolvedActiveGroupId}
              aria-controls="workforce-group-panel"
              aria-describedby={`workforce-group-tab-count-${group.id}`}
              tabIndex={group.id === resolvedActiveGroupId ? 0 : -1}
              className={`group-tab${group.id === resolvedActiveGroupId ? ' active' : ''}`}
              onClick={() => requestGroupChange(group.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              <span>{group.name}</span>
              {group.id === resolvedActiveGroupId && (
                <span className="group-tab-selected-indicator">
                  <CheckCircleIcon size={14} />
                  {t('groups.selectedLabel')}
                </span>
              )}
              <span className="group-tab-count" aria-hidden="true">
                {groupCountLabel}
              </span>
              <span id={`workforce-group-tab-count-${group.id}`} className="sr-only">
                {groupCountLabel}
              </span>
            </button>
          )
        })}
      </div>

      {activeGroup && (
        <div
          id="workforce-group-panel"
          className="working-calendars-panel"
          role="tabpanel"
          aria-labelledby={`workforce-group-tab-${activeGroup.id}`}
        >
          <section
            className="working-calendars-impact"
            data-testid="working-calendars-impact"
            aria-labelledby="working-calendars-impact-title"
          >
            <div>
              <p className="working-calendars-step">{t('groups.impact.step')}</p>
              <h3 id="working-calendars-impact-title">
                {t('groups.impact.title')}
              </h3>
              <p>
                {draftWeekendDays.length > 0
                  ? t('groups.impact.summary', {
                      days: weekendList,
                      count:
                        activeMemberCount == null
                          ? t('groups.count.unknownValue')
                          : activeMemberCount,
                      name: activeGroup.name,
                    })
                  : t('groups.impact.noWeekend', { name: activeGroup.name })}
              </p>
              <p className="working-calendars-history-note">
                {t('groups.impact.history')}
              </p>
            </div>
            <div className="working-calendars-impact-meta">
              <span>{t('groups.impact.affected')}</span>
              <strong data-testid="working-calendars-affected-count">
                {countLabel}
              </strong>
              <span className="working-calendars-policy-health">
                {draftWeekendDays.length > 0
                  ? t('groups.impact.ready')
                  : t('groups.impact.needsWeekend')}
              </span>
            </div>
          </section>

          <div className="settings-card-body">
            <div className="settings-col settings-col-weekends">
              <p className="settings-card-label">
                {t('groups.weekendLabel')} <span>{activeGroup.name}</span>
              </p>
              <WeekendDayChips
                groupName={activeGroup.name}
                weekendDays={draftWeekendDays}
                disabled={updateWeekendsMutation.isPending}
                onChange={(weekendDays) => {
                  setDraftWeekendDays(weekendDays)
                  setSavedMessage('')
                }}
              />
              <div className="working-calendars-save-row">
                {draftWeekendDays.length === 0 ? (
                  <p className="working-calendars-validation" role="alert">
                    {t('groups.selectWeekend')}
                  </p>
                ) : (
                  <p className="working-calendars-draft-state">
                    {weekendDirty ? t('groups.unsaved') : t('groups.saved')}
                  </p>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  data-testid="working-calendars-save-btn"
                  disabled={
                    !weekendDirty ||
                    draftWeekendDays.length === 0 ||
                    updateWeekendsMutation.isPending
                  }
                  data-busy={updateWeekendsMutation.isPending ? 'true' : undefined}
                  onClick={() => {
                    if (updateWeekendsMutation.isPending) {
                      return
                    }
                    updateWeekendsMutation.mutate({
                      groupId: activeGroup.id,
                      weekendDays: draftWeekendDays,
                    })
                  }}
                >
                  {updateWeekendsMutation.isPending
                    ? t('groups.actions.saving')
                    : t('groups.actions.save')}
                </button>
              </div>
            </div>
            <PublicHolidaysSection
              activeGroupId={activeGroup.id}
              activeGroupName={activeGroup.name}
              discardSignal={discardSignal}
              onDirtyChange={setHolidaysDirty}
              onSuccess={onSuccess}
              onWarning={onWarning}
            />
          </div>

          {savedMessage && (
            <p className="working-calendars-saved-status" role="status">
              <CheckCircleIcon size={18} /> {savedMessage}
            </p>
          )}
        </div>
      )}

      {groupModalOpen && (
        <WorkforceGroupModal
          onClose={() => setGroupModalOpen(false)}
          onSuccess={(message, newGroupId) => {
            void queryClient.invalidateQueries({ queryKey })
            requestGroupChange(newGroupId)
            onSuccess?.(message)
          }}
          onWarning={onWarning}
        />
      )}
    </section>
  )
}
