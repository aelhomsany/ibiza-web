import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getTeamMembers } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
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
  return `badge badge-${role}`
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

export function TeamMembersCard({ onSuccess, onWarning }: Props) {
  const { user } = useAuth()
  const orgId = user?.organizationId

  const queryKey = ['team-members', orgId] as const

  const membersQuery = useQuery({
    queryKey,
    queryFn: getTeamMembers,
    enabled: orgId != null,
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [editMemberId, setEditMemberId] = useState<number | null>(null)

  const members = membersQuery.data ?? []

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

  return (
    <section className="settings-card" style={{ marginTop: 24 }}>
      <div className="card-section-header">
        <span className="card-section-title">Team Members</span>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={openAdd}
          data-testid="add-member-btn"
        >
          + Add Member
        </button>
      </div>

      {membersQuery.isPending && (
        <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Loading…</p>
      )}

      {!membersQuery.isPending && members.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>No team members yet.</p>
      )}

      <div data-testid="team-members-list">
        {members.map((member) => (
          <div key={member.id} className="settings-list-item">
            <div className="member-avatar" aria-hidden="true">
              {initials(member.fullName ?? '')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="member-name-row">
                {member.fullName}
                {member.workforceGroupName && (
                  <span className="group-pill">{member.workforceGroupName}</span>
                )}
              </div>
              <div className="member-meta">
                {member.email}
                {member.department ? ` · ${member.department}` : ''}
                {member.managerName ? ` · Reports to ${member.managerName.split(' ')[0]}` : ''}
              </div>
            </div>
            <span className={roleBadgeClass(member.role ?? '')} style={{ marginRight: 8 }}>
              {roleLabel(member.role ?? '')}
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => openEdit(member.id!)}
              data-testid={`edit-member-${member.id}`}
            >
              Edit
            </button>
          </div>
        ))}
      </div>

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
