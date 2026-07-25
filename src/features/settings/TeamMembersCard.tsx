import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ApiError,
  deactivateTeamMember,
  getTeamMembers,
  reactivateTeamMember,
} from '../../api/client'
import type { TeamMemberSummaryResponse } from '../../api/generated/types'
import { useAuth } from '../../auth/useAuth'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon, PlusIcon } from '../../components/ui/icons'
import { pillColorStyle } from '../../utils/entityColor'
import { TeamMemberModal } from './TeamMemberModal'
import './team-members.css'

type Props = {
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

export function TeamMembersCard({ onSuccess, onWarning }: Props) {
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
  const [editMemberId, setEditMemberId] = useState<number | null>(null)
  const [lifecycleTarget, setLifecycleTarget] = useState<TeamMemberSummaryResponse | null>(null)

  const members = membersQuery.data ?? []
  const isLifecycleDeactivation = lifecycleTarget?.status !== 'DEACTIVATED'
  const lifecycleTitle = isLifecycleDeactivation
    ? t('settings:members.deactivateTitle')
    : t('settings:members.reactivateTitle')
  const lifecycleConfirmLabel = isLifecycleDeactivation
    ? t('settings:members.actions.confirmDeactivate')
    : t('settings:members.actions.confirmReactivate')

  function openAdd() {
    setEditMemberId(null)
    setModalOpen(true)
  }

  function openEdit(id: number) {
    setEditMemberId(id)
    setModalOpen(true)
  }

  function handleClose() {
    setModalOpen(false)
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

  return (
    <section className="settings-card settings-card-spaced" data-testid="team-members-card">
      <div className="card-section-header">
        <span className="card-section-title">{t('settings:members.title')}</span>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={openAdd}
          data-testid="add-member-btn"
        >
          <PlusIcon size={14} /> {t('settings:members.actions.add')}
        </button>
      </div>

      {membersQuery.isPending && (
        <LoadingState
          label={t('layout:loading.teamMembers')}
          testId="team-members-loading"
          className="settings-list-hint"
        />
      )}

      {!membersQuery.isPending && members.length === 0 && (
        <p className="settings-list-hint">{t('settings:members.none')}</p>
      )}

      <div className="settings-list-body" data-testid="team-members-list">
        {members.map((member) => {
          const isDeactivated = member.status === 'DEACTIVATED'
          return (
          <div
            key={member.id}
            className={`settings-list-item${isDeactivated ? ' settings-list-item-muted' : ''}`}
          >
            <div className="member-avatar" aria-hidden="true">
              {initials(member.fullName ?? '')}
            </div>
            <div className="member-details">
              <div className="member-name-row">
                {member.fullName}
                {member.workforceGroupName && (
                  <span
                    className="group-pill"
                    style={pillColorStyle(
                      member.workforceGroupId ?? member.workforceGroupName.trim().toLowerCase(),
                    )}
                  >
                    {member.workforceGroupName}
                  </span>
                )}
              </div>
              <div className="member-meta">
                {member.email}
                {member.department ? ` · ${member.department}` : ''}
                {member.managerName
                  ? ` · ${t('settings:members.reportsTo', { name: member.managerName.split(' ')[0] })}`
                  : ''}
              </div>
            </div>
            <span className={roleBadgeClass(member.role ?? '')}>
              {member.role && i18n.exists(`common:roles.${roleKey(member.role)}`)
                ? t(`common:roles.${roleKey(member.role)}`)
                : member.role ?? t('common:unknown')}
            </span>
            <span className={`member-status-badge${isDeactivated ? ' is-deactivated' : ''}`}>
              {t(member.status === 'DEACTIVATED' ? 'common:status.deactivated' : 'common:status.active')}
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => openLifecycleConfirm(member)}
              data-testid={`${isDeactivated ? 'reactivate' : 'deactivate'}-member-${member.id}`}
              aria-label={t(
                isDeactivated
                  ? 'settings:members.aria.reactivate'
                  : 'settings:members.aria.deactivate',
                { name: member.fullName },
              )}
            >
              {isDeactivated
                ? t('settings:members.actions.reactivate')
                : t('settings:members.actions.deactivate')}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => openEdit(member.id!)}
              data-testid={`edit-member-${member.id}`}
              aria-label={t('settings:members.aria.edit', { name: member.fullName })}
            >
              {t('common:actions.edit')}
            </button>
          </div>
          )
        })}
      </div>

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
                ? t('settings:members.deactivateCopy', { name: lifecycleTarget.fullName })
                : t('settings:members.reactivateCopy', { name: lifecycleTarget.fullName })}
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
          onClose={handleClose}
          onSuccess={(msg) => {
            handleClose()
            onSuccess?.(msg)
          }}
          onWarning={onWarning}
        />
      )}
    </section>
  )
}

function roleKey(role: string): string {
  if (role === 'HR_ADMIN') return 'hrAdmin'
  return role.toLowerCase()
}
