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

function roleLabel(role: string): string {
  switch (role) {
    case 'HR_ADMIN':
      return 'HR Admin'
    case 'MANAGER':
      return 'Manager'
    case 'EMPLOYEE':
      return 'Employee'
    default:
      return role
  }
}

function statusLabel(status: TeamMemberSummaryResponse['status']): string {
  return status === 'DEACTIVATED' ? 'Deactivated' : 'Active'
}

export function TeamMembersCard({ onSuccess, onWarning }: Props) {
  const { t } = useTranslation('layout')
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
    ? 'Deactivate Team Member'
    : 'Reactivate Team Member'
  const lifecycleConfirmLabel = isLifecycleDeactivation
    ? 'Confirm Deactivation'
    : 'Confirm Reactivation'

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
      const name = updated.fullName ?? member.fullName ?? 'Team member'
      onSuccess?.(`${name} ${updated.status === 'DEACTIVATED' ? 'deactivated' : 'reactivated'}`)
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.problem.detail ?? 'Unable to update team member status'
          : 'Unable to update team member status'
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
        <span className="card-section-title">Team Members</span>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={openAdd}
          data-testid="add-member-btn"
        >
          <PlusIcon size={14} /> Add Member
        </button>
      </div>

      {membersQuery.isPending && (
        <LoadingState
          label={t('loading.teamMembers')}
          testId="team-members-loading"
          className="settings-list-hint"
        />
      )}

      {!membersQuery.isPending && members.length === 0 && (
        <p className="settings-list-hint">No team members yet.</p>
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
                {member.managerName ? ` · Reports to ${member.managerName.split(' ')[0]}` : ''}
              </div>
            </div>
            <span className={roleBadgeClass(member.role ?? '')}>
              {roleLabel(member.role ?? '')}
            </span>
            <span className={`member-status-badge${isDeactivated ? ' is-deactivated' : ''}`}>
              {statusLabel(member.status)}
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => openLifecycleConfirm(member)}
              data-testid={`${isDeactivated ? 'reactivate' : 'deactivate'}-member-${member.id}`}
            >
              {isDeactivated ? 'Reactivate' : 'Deactivate'}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => openEdit(member.id!)}
              data-testid={`edit-member-${member.id}`}
            >
              Edit
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
              aria-label="Close"
              disabled={lifecycleMutation.isPending}
            >
              <CloseIcon size={18} />
            </button>
          </div>
          <div className="modal-body">
            <p className="body-text">
              {isLifecycleDeactivation
                ? `${lifecycleTarget.fullName} will lose access and stop counting toward the active seat limit. Historical records stay visible.`
                : `${lifecycleTarget.fullName} will regain access if the active seat limit allows it.`}
            </p>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={closeLifecycleConfirm}
              disabled={lifecycleMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${isLifecycleDeactivation ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => lifecycleMutation.mutate(lifecycleTarget)}
              disabled={lifecycleMutation.isPending}
              data-busy={lifecycleMutation.isPending ? 'true' : undefined}
            >
              {lifecycleMutation.isPending ? 'Saving…' : lifecycleConfirmLabel}
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
