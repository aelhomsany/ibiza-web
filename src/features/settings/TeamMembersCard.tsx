import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isolate } from '../../i18n/bidi'
import {
  ApiError,
  deactivateTeamMember,
  getTeamMembers,
  reactivateTeamMember,
} from '../../api/client'
import type { TeamMemberSummaryResponse } from '../../api/generated/types'
import { useAuth } from '../../auth/useAuth'
import { HorizontalScrollRegion } from '../../components/ui/HorizontalScrollRegion'
import { RowActionsMenu } from '../../components/ui/RowActionsMenu'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon, PlusIcon } from '../../components/ui/icons'
import { pillColorStyle } from '../../utils/entityColor'
import { TeamMemberModal } from './TeamMemberModal'
import './team-members.css'

type Props = {
  discardSignal?: number
  onDirtyChange?: (dirty: boolean) => void
  onSuccess?: (message: string) => void
  onWarning?: (message: string) => void
}

function initials(fullName: string): string {
  return fullName
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function roleBadgeClass(role: string): string {
  return `role-badge role-badge-${role}`
}

export function TeamMembersCard({
  discardSignal = 0,
  onDirtyChange,
  onSuccess,
  onWarning,
}: Props) {
  const { t, i18n } = useTranslation(['settings', 'layout', 'common'])
  const { user } = useAuth()
  const orgId = user?.organizationId
  const queryClient = useQueryClient()

  const queryKey = ['team-members', orgId] as const

  const membersQuery = useQuery({
    queryKey,
    queryFn: getTeamMembers,
    enabled: orgId != null,
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [editMemberId, setEditMemberId] = useState<number | null>(null)
  const [lifecycleTarget, setLifecycleTarget] = useState<TeamMemberSummaryResponse | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const lastDiscardSignal = useRef(discardSignal)

  // Guard the add/edit member form (the "consequential form" AC10 calls out) —
  // but only once the user has actually edited a field, not merely opened the
  // dialog. This avoids a spurious discard prompt for an empty draft and the
  // route-blocker modal stacking on top of an untouched member dialog.
  useEffect(() => {
    onDirtyChange?.(modalOpen && formDirty)
  }, [modalOpen, formDirty, onDirtyChange])

  useEffect(
    () => () => {
      onDirtyChange?.(false)
    },
    [onDirtyChange],
  )

  useEffect(() => {
    if (lastDiscardSignal.current === discardSignal) {
      return
    }
    lastDiscardSignal.current = discardSignal
    setModalOpen(false)
    setFormDirty(false)
    setEditMemberId(null)
  }, [discardSignal])

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data])
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase(i18n.language)
  const filteredMembers = useMemo(() => {
    if (!normalizedSearch) {
      return members
    }
    return members.filter((member) =>
      [
        member.fullName,
        member.email,
        member.department,
        member.role,
        // Search the same humanized label the row displays (e.g. "HR Admin"),
        // not just the raw enum, alongside the raw value for exact-enum typers.
        member.role && i18n.exists(`common:roles.${roleKey(member.role)}`)
          ? t(`common:roles.${roleKey(member.role)}`)
          : null,
        member.workforceGroupName,
        member.managerName,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase(i18n.language).includes(normalizedSearch),
        ),
    )
  }, [i18n, members, normalizedSearch, t])
  // The rail describes the organization, so it reads `members` rather than `filteredMembers` — a
  // search term narrows the table, not the roster it is a summary of.
  const activeMembers = useMemo(
    () => members.filter((member) => member.status !== 'DEACTIVATED'),
    [members],
  )
  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const member of activeMembers) {
      const role = member.role ?? 'EMPLOYEE'
      counts.set(role, (counts.get(role) ?? 0) + 1)
    }
    // Fixed order, strongest first: a Map keyed by arrival order would reshuffle the rail every
    // time somebody's role changed.
    return (['HR_ADMIN', 'MANAGER', 'EMPLOYEE'] as const)
      .map((role) => ({ role, count: counts.get(role) ?? 0 }))
      .filter(({ count }) => count > 0)
  }, [activeMembers])
  const groupCounts = useMemo(() => {
    const counts = new Map<string | null, number>()
    for (const member of activeMembers) {
      const group = member.workforceGroupName ?? null
      counts.set(group, (counts.get(group) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort(([aName, aCount], [bName, bCount]) =>
        // Biggest group first; ties by name so the order is stable between renders. The
        // ungrouped bucket sorts last whatever its size — it is a gap, not a group.
        aName === null ? 1 : bName === null ? -1 : bCount - aCount || aName.localeCompare(bName),
      )
      .map(([name, count]) => ({ name, count }))
  }, [activeMembers])
  // Who the approval load actually sits on. Counting direct reports rather than approval steps
  // because that is what this table carries; the approval chain itself lives elsewhere.
  const topApprover = useMemo(() => {
    const counts = new Map<string, number>()
    for (const member of activeMembers) {
      if (member.managerName) {
        counts.set(member.managerName, (counts.get(member.managerName) ?? 0) + 1)
      }
    }
    let best: { name: string; count: number } | null = null
    for (const [name, count] of counts) {
      if (!best || count > best.count || (count === best.count && name.localeCompare(best.name) < 0)) {
        best = { name, count }
      }
    }
    return best
  }, [activeMembers])
  const approvalConcentrated =
    topApprover != null && activeMembers.length > 2 && topApprover.count * 2 > activeMembers.length

  const isLifecycleDeactivation = lifecycleTarget?.status !== 'DEACTIVATED'
  const lifecycleTitle = isLifecycleDeactivation
    ? t('settings:members.deactivateTitle')
    : t('settings:members.reactivateTitle')
  const lifecycleConfirmLabel = isLifecycleDeactivation
    ? t('settings:members.actions.confirmDeactivate')
    : t('settings:members.actions.confirmReactivate')

  function openAdd() {
    setFormDirty(false)
    setEditMemberId(null)
    setModalOpen(true)
  }

  function openEdit(id: number) {
    setFormDirty(false)
    setEditMemberId(id)
    setModalOpen(true)
  }

  function handleClose() {
    setModalOpen(false)
    setFormDirty(false)
    setEditMemberId(null)
  }

  const lifecycleMutation = useMutation({
    mutationFn: (member: TeamMemberSummaryResponse) => {
      const id = member.id!
      return member.status === 'DEACTIVATED'
        ? reactivateTeamMember(id)
        : deactivateTeamMember(id)
    },
    onSuccess: (updated, member) => {
      void queryClient.invalidateQueries({ queryKey })
      void queryClient.invalidateQueries({ queryKey: ['platform', 'organizations'] })
      setLifecycleTarget(null)
      const name = updated.fullName ?? member.fullName ?? t('common:unknown')
      onSuccess?.(
        t(
          updated.status === 'DEACTIVATED'
            ? 'settings:members.success.deactivated'
            : 'settings:members.success.reactivated',
          { name },
        ),
      )
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.problem.detail ?? t('settings:members.errors.status')
          : t('settings:members.errors.status')
      onWarning?.(message)
    },
  })

  function openLifecycleConfirm(member: TeamMemberSummaryResponse) {
    setLifecycleTarget(member)
  }

  function closeLifecycleConfirm() {
    if (!lifecycleMutation.isPending) {
      setLifecycleTarget(null)
    }
  }

  // Not a rail on this panel: the roster table's own min-content width is 849px against an
  // 854px region, so nothing fits beside it, and a rail beside the header above it would leave
  // the reading column empty for the rail's whole height. The same notes run as a band across
  // the top of the panel -- the roster at a glance, ahead of the roster itself.
  return (
    <div className="panel-stack">
      <aside className="support-band">
        <section className="support-note" aria-labelledby="members-composition-title">
          <h3 className="support-note-title" id="members-composition-title">
            {t('settings:members.rail.compositionTitle')}
          </h3>
          <dl className="support-note-list">
            {roleCounts.map(({ role, count }) => (
              <div className="support-note-kv" key={role}>
                <dt>{t(`common:roles.${roleKey(role)}`)}</dt>
                <dd data-testid={`members-role-${role}`}>{count}</dd>
              </div>
            ))}
            {members.length > activeMembers.length && (
              <div className="support-note-kv">
                <dt>{t('settings:members.rail.deactivated')}</dt>
                <dd data-testid="members-deactivated">
                  {members.length - activeMembers.length}
                </dd>
              </div>
            )}
          </dl>
        </section>

        {groupCounts.length > 0 && (
          <section className="support-note" aria-labelledby="members-groups-title">
            <h3 className="support-note-title" id="members-groups-title">
              {t('settings:members.rail.byGroupTitle')}
            </h3>
            <dl className="support-note-list">
              {groupCounts.map(({ name, count }) => (
                <div className="support-note-kv" key={name ?? '__ungrouped'}>
                  <dt dir="auto">
                    <bdi>{name ?? t('settings:members.rail.noGroup')}</bdi>
                  </dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {activeMembers.length > 0 && (
          <section className="support-note" aria-labelledby="members-approvals-title">
            <h3 className="support-note-title" id="members-approvals-title">
              {t('settings:members.rail.approvalsTitle')}
            </h3>
            {topApprover ? (
              <dl className="support-note-list">
                <div className="support-note-kv">
                  <dt>{t('settings:members.rail.mostReports')}</dt>
                  <dd className="support-note-kv-quiet" dir="auto" data-testid="members-top-approver">
                    <bdi>{topApprover.name}</bdi> · {topApprover.count}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="support-note-body">{t('settings:members.rail.noApprovers')}</p>
            )}
            {approvalConcentrated && topApprover && (
              <p
                className="support-note-body support-note-footnote"
                data-testid="members-approval-concentrated"
              >
                {t('settings:members.rail.concentrated', { name: isolate(topApprover.name) })}
              </p>
            )}
          </section>
        )}
      </aside>

      <section className="settings-card settings-card-spaced" data-testid="team-members-card">
        <div className="card-section-header">
          <span className="card-section-title" id="team-members-title">
            {t('settings:members.title')}
          </span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={openAdd}
            data-testid="add-member-btn"
          >
            <PlusIcon size={14} /> {t('settings:members.actions.add')}
          </button>
        </div>

        <div className="team-members-list-controls">
          <label htmlFor="team-members-search" className="sr-only">
            {t('settings:members.search.label')}
          </label>
          <input
            id="team-members-search"
            type="search"
            value={searchQuery}
            placeholder={t('settings:members.search.placeholder')}
            onChange={(event) => setSearchQuery(event.target.value)}
            data-testid="team-members-search"
          />
          {!membersQuery.isPending && !membersQuery.isError && members.length > 0 && (
            <p role="status">
              {t('settings:members.search.results', {
                shown: filteredMembers.length,
                total: members.length,
              })}
            </p>
          )}
        </div>

        {membersQuery.isPending && (
          <LoadingState
            label={t('layout:loading.teamMembers')}
            testId="team-members-loading"
            className="settings-list-hint"
          />
        )}

        {membersQuery.isError && (
          <div className="settings-list-error" role="alert">
            <span>{t('settings:members.errors.load')}</span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => void membersQuery.refetch()}
            >
              {t('common:actions.retry')}
            </button>
          </div>
        )}

        {!membersQuery.isPending && !membersQuery.isError && members.length === 0 && (
          <p className="settings-list-hint">{t('settings:members.none')}</p>
        )}

        <div className="settings-list-body team-members-list-body" data-testid="team-members-list">
          {!membersQuery.isPending &&
            !membersQuery.isError &&
            members.length > 0 &&
            filteredMembers.length === 0 && (
              <p className="settings-list-hint">{t('settings:members.search.none')}</p>
            )}
          {filteredMembers.length > 0 && (
            <HorizontalScrollRegion
              labelledBy="team-members-title"
              describedById="team-members-scroll-hint"
              testId="team-members-scroll-region"
            >
              <table className="dashboard-table team-members-table">
                <thead>
                  <tr>
                    <th scope="col">{t('settings:members.columns.person')}</th>
                    <th scope="col">{t('settings:members.columns.group')}</th>
                    <th scope="col">{t('settings:members.columns.department')}</th>
                    <th scope="col">{t('settings:members.columns.role')}</th>
                    <th scope="col">{t('settings:members.columns.reportsTo')}</th>
                    <th scope="col">{t('settings:members.columns.status')}</th>
                    <th scope="col">
                      <span className="sr-only">
                        {t('settings:members.columns.actions')}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => {
                    const isDeactivated = member.status === 'DEACTIVATED'
                    return (
                      <tr
                        key={member.id}
                        className={isDeactivated ? 'settings-list-item-muted' : undefined}
                        data-testid={`team-member-row-${member.id}`}
                      >
                        <td>
                          <div className="member-identity">
                            <div className="member-avatar" aria-hidden="true">
                              {initials(member.fullName ?? '')}
                            </div>
                            <div className="member-identity-text">
                              <span className="member-name">
                                <bdi>{member.fullName}</bdi>
                              </span>
                              <span className="member-email">
                                <bdi>{member.email}</bdi>
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {member.workforceGroupName ? (
                            <span
                              dir="auto"
                              className="group-pill"
                              style={pillColorStyle(
                                member.workforceGroupId ??
                                  member.workforceGroupName.trim().toLowerCase(),
                              )}
                            >
                              {member.workforceGroupName}
                            </span>
                          ) : (
                            t('settings:members.columns.empty')
                          )}
                        </td>
                        <td>
                          {member.department ? (
                            <bdi>{member.department}</bdi>
                          ) : (
                            t('settings:members.columns.empty')
                          )}
                        </td>
                        <td>
                          <span className={roleBadgeClass(member.role ?? '')}>
                            {member.role && i18n.exists(`common:roles.${roleKey(member.role)}`)
                              ? t(`common:roles.${roleKey(member.role)}`)
                              : member.role ?? t('common:unknown')}
                          </span>
                        </td>
                        <td>
                          {member.managerName ? (
                            <bdi>{member.managerName}</bdi>
                          ) : (
                            t('settings:members.columns.empty')
                          )}
                        </td>
                        <td>
                          <span
                            className={`member-status-badge${isDeactivated ? ' is-deactivated' : ''}`}
                          >
                            {t(
                              isDeactivated
                                ? 'common:status.deactivated'
                                : 'common:status.active',
                            )}
                          </span>
                        </td>
                        <td>
                          <div className="member-row-actions">
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => openEdit(member.id!)}
                              data-testid={`edit-member-${member.id}`}
                              aria-label={t('settings:members.aria.edit', {
                                name: member.fullName,
                              })}
                            >
                              {t('common:actions.edit')}
                            </button>
                            {/* Two full-width buttons per row cost 190px of the table's
                                width, which pushed the last column off the edge on a
                                laptop. Edit is the everyday action and stays visible;
                                deactivation is rare and destructive, so it moves behind
                                the overflow menu where it is harder to hit by accident. */}
                            <RowActionsMenu
                              testId={`member-menu-${member.id}`}
                              label={t('settings:members.aria.moreActions', {
                                name: member.fullName,
                              })}
                              actions={[
                                {
                                  id: 'lifecycle',
                                  label: t(
                                    isDeactivated
                                      ? 'settings:members.actions.reactivate'
                                      : 'settings:members.actions.deactivate',
                                  ),
                                  ariaLabel: t(
                                    isDeactivated
                                      ? 'settings:members.aria.reactivate'
                                      : 'settings:members.aria.deactivate',
                                    { name: member.fullName },
                                  ),
                                  testId: `${isDeactivated ? 'reactivate' : 'deactivate'}-member-${member.id}`,
                                  destructive: !isDeactivated,
                                  onSelect: () => openLifecycleConfirm(member),
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </HorizontalScrollRegion>
          )}
        </div>
      </section>

      {lifecycleTarget && (
        <Modal
          labelledBy="team-member-lifecycle-title"
          onClose={closeLifecycleConfirm}
          closeOnBackdrop={false}
        >
          <div className="modal-header">
            <h2 className="modal-title" id="team-member-lifecycle-title">
              {lifecycleTitle}
            </h2>
            <button
              type="button"
              className="modal-close"
              onClick={closeLifecycleConfirm}
              aria-label={t('common:actions.close')}
              disabled={lifecycleMutation.isPending}
            >
              <CloseIcon size={18} />
            </button>
          </div>
          <div className="modal-body">
            <p className="body-text">
              {isLifecycleDeactivation
                ? t('settings:members.deactivateCopy', { name: isolate(lifecycleTarget.fullName) })
                : t('settings:members.reactivateCopy', { name: isolate(lifecycleTarget.fullName) })}
            </p>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={closeLifecycleConfirm}
              disabled={lifecycleMutation.isPending}
            >
              {t('common:actions.cancel')}
            </button>
            <button
              type="button"
              className={`btn ${isLifecycleDeactivation ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => lifecycleMutation.mutate(lifecycleTarget)}
              disabled={lifecycleMutation.isPending}
              data-busy={lifecycleMutation.isPending ? 'true' : undefined}
            >
              {lifecycleMutation.isPending ? t('common:actions.saving') : lifecycleConfirmLabel}
            </button>
          </div>
        </Modal>
      )}

      {modalOpen && (
        <TeamMemberModal
          editMemberId={editMemberId}
          onDirtyChange={setFormDirty}
          onClose={handleClose}
          onSuccess={(msg) => {
            handleClose()
            // A newly added/edited member can otherwise stay hidden behind a
            // stale search term right after the success toast fires.
            setSearchQuery('')
            onSuccess?.(msg)
          }}
          onWarning={onWarning}
        />
      )}
    </div>
  )
}

function roleKey(role: string): string {
  if (role === 'HR_ADMIN') return 'hrAdmin'
  return role.toLowerCase()
}
