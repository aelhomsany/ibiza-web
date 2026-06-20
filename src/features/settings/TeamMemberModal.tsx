import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  ApiError,
  createTeamMember,
  getLeaveTypes,
  getTeamMember,
  getTeamMembers,
  getWorkforceGroups,
  updateTeamMember,
} from '../../api/client'
import type {
  CreateTeamMemberRequest,
  EntitlementInput,
  UpdateTeamMemberRequest,
} from '../../api/generated/types'
import { useAuth } from '../../auth/useAuth'
import './team-members.css'

type Props = {
  editMemberId: number | null
  onClose: () => void
  onSuccess: (message: string) => void
  onWarning?: (message: string) => void
}

type UserRole = 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN'

type LeaveTypeOption = {
  id: number
  name: string
  defaultBalanceDays: number
}

export function TeamMemberModal({ editMemberId, onClose, onSuccess, onWarning }: Props) {
  const { user } = useAuth()
  const orgId = user?.organizationId
  const queryClient = useQueryClient()
  const isEdit = editMemberId != null

  const groupsQuery = useQuery({
    queryKey: ['workforce-groups', orgId],
    queryFn: getWorkforceGroups,
    enabled: orgId != null,
  })

  const leaveTypesQuery = useQuery({
    queryKey: ['leave-types', orgId],
    queryFn: getLeaveTypes,
    enabled: orgId != null,
  })

  const membersQuery = useQuery({
    queryKey: ['team-members', orgId],
    queryFn: getTeamMembers,
    enabled: orgId != null,
  })

  const editMemberQuery = useQuery({
    queryKey: ['team-member', editMemberId],
    queryFn: () => getTeamMember(editMemberId!),
    enabled: isEdit,
  })

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('')
  const [role, setRole] = useState<UserRole>('EMPLOYEE')
  const [workforceGroupId, setWorkforceGroupId] = useState<number | ''>('')
  const [managerId, setManagerId] = useState<number | ''>('')
  const [entitlements, setEntitlements] = useState<Record<number, number>>({})
  const [groupError, setGroupError] = useState(false)

  const groups = groupsQuery.data ?? []
  const allMembers = membersQuery.data ?? []
  const cappedLeaveTypes: LeaveTypeOption[] = (leaveTypesQuery.data ?? [])
    .filter((lt) => lt.defaultBalanceDays != null)
    .map((lt) => ({ id: lt.id!, name: lt.name!, defaultBalanceDays: lt.defaultBalanceDays! }))

  const managers = allMembers.filter(
    (m) => m.role === 'MANAGER' || m.role === 'HR_ADMIN',
  )

  useEffect(() => {
    if (isEdit && editMemberQuery.data) {
      const m = editMemberQuery.data
      setFullName(m.fullName ?? '')
      setDepartment(m.department ?? '')
      setRole((m.role as UserRole) ?? 'EMPLOYEE')
      setWorkforceGroupId(m.workforceGroupId ?? '')
      setManagerId(m.managerId ?? '')
      const entMap: Record<number, number> = {}
      for (const e of m.entitlements ?? []) {
        if (e.leaveTypeId) entMap[e.leaveTypeId] = e.allocatedDays ?? 0
      }
      setEntitlements(entMap)
    } else if (!isEdit && cappedLeaveTypes.length > 0) {
      const entMap: Record<number, number> = {}
      for (const lt of cappedLeaveTypes) {
        entMap[lt.id] = lt.defaultBalanceDays
      }
      setEntitlements(entMap)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editMemberQuery.data])

  useEffect(() => {
    if (!isEdit && cappedLeaveTypes.length > 0) {
      setEntitlements((prev) => {
        const next = { ...prev }
        for (const lt of cappedLeaveTypes) {
          if (!(lt.id in next)) next[lt.id] = lt.defaultBalanceDays
        }
        return next
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cappedLeaveTypes.length, isEdit])

  useEffect(() => {
    if (role !== 'EMPLOYEE') {
      setManagerId('')
    }
  }, [role])

  const createMutation = useMutation({
    mutationFn: (payload: CreateTeamMemberRequest) => createTeamMember(payload),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['team-members', orgId] })
      onSuccess(`${created.fullName} added to Ibiza!`)
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError ? err.problem.detail ?? 'Failed to add member' : 'Failed to add member'
      onWarning?.(msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateTeamMemberRequest }) =>
      updateTeamMember(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['team-members', orgId] })
      void queryClient.invalidateQueries({ queryKey: ['team-member', editMemberId] })
      onSuccess('Team member updated.')
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError ? err.problem.detail ?? 'Failed to update member' : 'Failed to update member'
      onWarning?.(msg)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!workforceGroupId) {
      setGroupError(true)
      return
    }
    setGroupError(false)

    const entitlementInputs: EntitlementInput[] = cappedLeaveTypes.map((lt) => ({
      leaveTypeId: lt.id,
      allocatedDays: entitlements[lt.id] ?? lt.defaultBalanceDays,
    }))

    const resolvedManagerId =
      role === 'EMPLOYEE'
        ? managerId !== ''
          ? (managerId as number)
          : null
        : null

    if (isEdit && editMemberId) {
      const payload: UpdateTeamMemberRequest = {
        fullName,
        department,
        role,
        workforceGroupId: workforceGroupId as number,
        managerId: resolvedManagerId ?? undefined,
        entitlements: entitlementInputs,
      }
      updateMutation.mutate({ id: editMemberId, payload })
    } else {
      const payload: CreateTeamMemberRequest = {
        fullName,
        email,
        department,
        role,
        workforceGroupId: workforceGroupId as number,
        managerId:
          role === 'EMPLOYEE' && resolvedManagerId != null ? resolvedManagerId : undefined,
        entitlements: entitlementInputs,
      }
      createMutation.mutate(payload)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-member-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title" id="team-member-modal-title">
            {isEdit ? 'Edit Team Member' : 'Add Team Member'}
          </span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="tm-fullname">Full name</label>
            <input
              id="tm-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          {!isEdit && (
            <div className="form-group">
              <label htmlFor="tm-email">Email</label>
              <input
                id="tm-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="tm-dept">Department</label>
            <input
              id="tm-dept"
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
            />
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label htmlFor="tm-role">Role</label>
              <select
                id="tm-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="MANAGER">Manager</option>
                <option value="HR_ADMIN">HR Admin</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="tm-group">
                Workforce Group <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <select
                id="tm-group"
                value={workforceGroupId}
                onChange={(e) => {
                  setWorkforceGroupId(e.target.value === '' ? '' : Number(e.target.value))
                  setGroupError(false)
                }}
                required
                aria-invalid={groupError}
              >
                <option value="">— Select group —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              {groupError && (
                <span className="field-error" role="alert">
                  Workforce Group is required
                </span>
              )}
            </div>
          </div>

          {role === 'EMPLOYEE' && (
            <div className="form-group" data-testid="manager-field">
              <label htmlFor="tm-manager">Reports to</label>
              <select
                id="tm-manager"
                value={managerId}
                onChange={(e) =>
                  setManagerId(e.target.value === '' ? '' : Number(e.target.value))
                }
              >
                <option value="">— None —</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {cappedLeaveTypes.length > 0 && (
            <div className="form-group">
              <label>Annual entitlements (working days per year)</label>
              {cappedLeaveTypes.map((lt) => (
                <div key={lt.id} className="entitlement-row" data-testid={`ent-row-${lt.id}`}>
                  <label htmlFor={`ent-${lt.id}`}>{lt.name}</label>
                  <input
                    id={`ent-${lt.id}`}
                    type="number"
                    min={0}
                    value={entitlements[lt.id] ?? lt.defaultBalanceDays}
                    onChange={(e) =>
                      setEntitlements((prev) => ({
                        ...prev,
                        [lt.id]: Number(e.target.value),
                      }))
                    }
                    data-testid={`ent-input-${lt.id}`}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
