import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isolate } from '../../i18n/bidi'
import {
  ApiError,
  createCheckoutSession,
  createTeamMember,
  getLeaveTypes,
  getTeamMember,
  getTeamMembers,
  getWorkforceGroups,
  updateTeamMember,
} from '../../api/client'
import {
  fieldErrorsFromApiError,
  TEAM_MEMBER_FIELD_IDS,
} from '../../api/fieldViolations'
import type {
  CreateCheckoutSessionRequest,
  CreateTeamMemberRequest,
  EntitlementInput,
  UpdateTeamMemberRequest,
} from '../../api/generated/types'
import { useAuth } from '../../auth/useAuth'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'
import { FieldErrorMessage } from '../../components/form/FieldErrorMessage'
import { redirectToExternalUrl } from '../../navigation/redirect'
import { translateFieldViolation } from '../../i18n/fieldViolationMessage'
import './team-members.css'

type Props = {
  editMemberId: number | null
  onClose: () => void
  onSuccess: (message: string) => void
  onWarning?: (message: string) => void
  // Reports whether the user has actually edited a field (vs. merely opening
  // the dialog), so the unsaved-changes guard only engages on real changes.
  onDirtyChange?: (dirty: boolean) => void
}

type UserRole = 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN'
type UpgradePlan = Extract<CreateCheckoutSessionRequest['plan'], 'STARTER' | 'GROWTH'>

type LeaveTypeOption = {
  id: number
  name: string
  defaultBalanceDays: number
}

export function TeamMemberModal({
  editMemberId,
  onClose,
  onSuccess,
  onWarning,
  onDirtyChange,
}: Props) {
  const { t } = useTranslation(['settings', 'common'])
  const { user } = useAuth()
  const orgId = user?.organizationId
  const queryClient = useQueryClient()
  const isEdit = editMemberId != null
  // Set by the form-level onChange below on any real field edit. Programmatic
  // state updates (initial load, entitlement defaults, role→manager reset) do
  // not dispatch DOM change events, so they never flip this.
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

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
  const [approvalApproverIds, setApprovalApproverIds] = useState<Array<number | ''>>(['', '', ''])
  const [approvalChainTouched, setApprovalChainTouched] = useState(false)
  const [approvalChainError, setApprovalChainError] = useState(false)
  const [entitlements, setEntitlements] = useState<Record<number, number>>({})
  const [groupError, setGroupError] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [upgradePrompt, setUpgradePrompt] = useState<{
    detail: string
    checkoutUnavailable: boolean
  } | null>(null)
  const [upgradePlan, setUpgradePlan] = useState<UpgradePlan>('STARTER')
  const upgradePromptRef = useRef<HTMLDivElement>(null)

  const groups = groupsQuery.data ?? []
  const allMembers = useMemo(() => membersQuery.data ?? [], [membersQuery.data])
  const cappedLeaveTypes: LeaveTypeOption[] = (leaveTypesQuery.data ?? [])
    .filter((lt) => lt.defaultBalanceDays != null)
    .map((lt) => ({ id: lt.id!, name: lt.name!, defaultBalanceDays: lt.defaultBalanceDays! }))

  const managers = allMembers.filter(
    (m) => (m.role === 'MANAGER' || m.role === 'HR_ADMIN') && m.status !== 'DEACTIVATED',
  )

  useEffect(() => {
    if (isEdit && editMemberQuery.data) {
      const m = editMemberQuery.data
      setFullName(m.fullName ?? '')
      setDepartment(m.department ?? '')
      setRole((m.role as UserRole) ?? 'EMPLOYEE')
      setWorkforceGroupId(m.workforceGroupId ?? '')
      setManagerId(m.managerId ?? '')
      const chain = (m.approvalChain ?? []).map((step) => step.userId ?? '')
      setApprovalApproverIds([chain[0] ?? m.managerId ?? '', chain[1] ?? '', chain[2] ?? ''])
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

  useEffect(() => {
    if (isEdit || approvalChainTouched) return

    const defaultApproverId = managerId !== ''
      ? managerId
      : allMembers.find((member) => member.role === 'HR_ADMIN' && member.status !== 'DEACTIVATED')?.id
    if (defaultApproverId != null) {
      setApprovalApproverIds((current) => [defaultApproverId, current[1], current[2]])
    }
  }, [allMembers, approvalChainTouched, isEdit, managerId])

  const upgradePromptVisible = upgradePrompt !== null
  useEffect(() => {
    if (upgradePromptVisible) {
      upgradePromptRef.current?.focus()
    }
  }, [upgradePromptVisible])

  const createMutation = useMutation({
    mutationFn: (payload: CreateTeamMemberRequest) => createTeamMember(payload),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['team-members', orgId] })
      setUpgradePrompt(null)
      onSuccess(t('settings:memberModal.success.added', { name: isolate(created.fullName) }))
    },
    onError: (err) => {
      if (isPlanLimitReached(err)) {
        setUpgradePrompt({
          detail: err.problem.detail ?? t('settings:memberModal.errors.planLimit'),
          checkoutUnavailable: false,
        })
        return
      }
      if (err instanceof ApiError) {
        const nextFieldErrors = fieldErrorsFromApiError(err.fieldViolations)
        if (nextFieldErrors) {
          const mappedFieldErrors = teamMemberFieldErrors(translateFieldErrors(nextFieldErrors))
          if (Object.keys(mappedFieldErrors).length > 0) {
            setFieldErrors(mappedFieldErrors)
          }
          if (Object.keys(mappedFieldErrors).length === Object.keys(nextFieldErrors).length) {
            return
          }
        }
      }
      const msg =
        err instanceof ApiError
          ? err.problem.detail ?? t('settings:memberModal.errors.add')
          : t('settings:memberModal.errors.add')
      onWarning?.(msg)
    },
  })

  const checkoutMutation = useMutation({
    mutationFn: (payload: CreateCheckoutSessionRequest) => createCheckoutSession(payload),
    onSuccess: (session) => {
      if (session.checkoutUrl) {
        redirectToExternalUrl(session.checkoutUrl)
        return
      }
      setUpgradePrompt((current) =>
        current ? { ...current, checkoutUnavailable: true } : current,
      )
    },
    onError: () => {
      setUpgradePrompt((current) =>
        current ? { ...current, checkoutUnavailable: true } : current,
      )
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateTeamMemberRequest }) =>
      updateTeamMember(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['team-members', orgId] })
      void queryClient.invalidateQueries({ queryKey: ['team-member', editMemberId] })
      onSuccess(t('settings:memberModal.success.updated'))
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const nextFieldErrors = fieldErrorsFromApiError(err.fieldViolations)
        if (nextFieldErrors) {
          const mappedFieldErrors = teamMemberFieldErrors(translateFieldErrors(nextFieldErrors))
          if (Object.keys(mappedFieldErrors).length > 0) {
            setFieldErrors(mappedFieldErrors)
          }
          if (Object.keys(mappedFieldErrors).length === Object.keys(nextFieldErrors).length) {
            return
          }
        }
      }
      const msg =
        err instanceof ApiError
          ? err.problem.detail ?? t('settings:memberModal.errors.update')
          : t('settings:memberModal.errors.update')
      onWarning?.(msg)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setUpgradePrompt(null)
    setFieldErrors({})
    if (!workforceGroupId) {
      setGroupError(true)
      return
    }
    const firstBlankIndex = approvalApproverIds.findIndex((id) => id === '')
    const hasGap = firstBlankIndex >= 0
      && approvalApproverIds.slice(firstBlankIndex + 1).some((id) => id !== '')
    if ((!isEdit || approvalChainTouched)
      && (approvalApproverIds[0] === '' || hasGap)) {
      setApprovalChainError(true)
      return
    }
    const selectedApprovers = approvalApproverIds.filter(
      (id): id is number => id !== '',
    )
    setApprovalChainError(false)
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
        approvalApproverIds: approvalChainTouched ? selectedApprovers : undefined,
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
        approvalApproverIds: selectedApprovers,
        entitlements: entitlementInputs,
      }
      createMutation.mutate(payload)
    }
  }

  function handleUpgrade() {
    checkoutMutation.mutate({ plan: upgradePlan })
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  function clearFieldError(field: string) {
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function fieldErrorProps(field: keyof typeof TEAM_MEMBER_FIELD_IDS) {
    const fieldId = TEAM_MEMBER_FIELD_IDS[field]
    const message =
      fieldErrors[field] ??
      (field === 'workforceGroupId' && groupError
        ? t('settings:memberModal.errors.groupRequired')
        : undefined)
    if (!message) {
      return { message: undefined, fieldId, invalid: false, describedBy: undefined }
    }
    return {
      message,
      fieldId,
      invalid: true,
      describedBy: `field-error-${fieldId}`,
    }
  }

  const fullNameError = fieldErrorProps('fullName')
  const emailError = fieldErrorProps('email')
  const departmentError = fieldErrorProps('department')
  const roleError = fieldErrorProps('role')
  const groupFieldError = fieldErrorProps('workforceGroupId')
  const approverOptions = allMembers.filter(
    (member) => member.status !== 'DEACTIVATED' && member.id !== editMemberId,
  )

  return (
    <Modal
      labelledBy="team-member-modal-title"
      onClose={onClose}
      className="modal-wide"
      closeOnBackdrop={false}
    >
        <div className="modal-header">
          <span className="modal-title" id="team-member-modal-title">
            {isEdit ? t('settings:memberModal.titleEdit') : t('settings:memberModal.titleAdd')}
          </span>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('common:actions.close')}>
            <CloseIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} onChange={() => setDirty(true)} noValidate>
          <div className="form-group">
            <label htmlFor="tm-fullname">{t('settings:memberModal.fields.fullName')}</label>
            <input
              id="tm-fullname"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value)
                clearFieldError('fullName')
              }}
              required
              aria-invalid={fullNameError.invalid || undefined}
              aria-describedby={fullNameError.describedBy}
            />
            {fullNameError.message && (
              <FieldErrorMessage fieldId={fullNameError.fieldId} message={fullNameError.message} />
            )}
          </div>

          {!isEdit && (
            <div className="form-group">
              <label htmlFor="tm-email">{t('settings:memberModal.fields.email')}</label>
              <input
                id="tm-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  clearFieldError('email')
                }}
                required
                aria-invalid={emailError.invalid || undefined}
                aria-describedby={emailError.describedBy}
              />
              {emailError.message && (
                <FieldErrorMessage fieldId={emailError.fieldId} message={emailError.message} />
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="tm-dept">{t('settings:memberModal.fields.department')}</label>
            <input
              id="tm-dept"
              type="text"
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value)
                clearFieldError('department')
              }}
              required
              aria-invalid={departmentError.invalid || undefined}
              aria-describedby={departmentError.describedBy}
            />
            {departmentError.message && (
              <FieldErrorMessage fieldId={departmentError.fieldId} message={departmentError.message} />
            )}
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label htmlFor="tm-role">{t('settings:memberModal.fields.role')}</label>
              <select
                id="tm-role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as UserRole)
                  clearFieldError('role')
                }}
                aria-invalid={roleError.invalid || undefined}
                aria-describedby={roleError.describedBy}
              >
                <option value="EMPLOYEE">{t('settings:memberModal.roles.employee')}</option>
                <option value="MANAGER">{t('settings:memberModal.roles.manager')}</option>
                <option value="HR_ADMIN">{t('settings:memberModal.roles.hrAdmin')}</option>
              </select>
              {roleError.message && (
                <FieldErrorMessage fieldId={roleError.fieldId} message={roleError.message} />
              )}
            </div>

            <div className="form-group">
              <label htmlFor="tm-group">
                {t('settings:memberModal.fields.workforceGroup')} <span className="field-required">*</span>
              </label>
              <select
                id="tm-group"
                value={workforceGroupId}
                onChange={(e) => {
                  setWorkforceGroupId(e.target.value === '' ? '' : Number(e.target.value))
                  setGroupError(false)
                  clearFieldError('workforceGroupId')
                }}
                required
                aria-invalid={groupFieldError.invalid || undefined}
                aria-describedby={groupFieldError.describedBy}
              >
                <option value="">{t('settings:memberModal.fields.selectGroup')}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id} dir="auto">
                    {g.name}
                  </option>
                ))}
              </select>
              {groupFieldError.message && (
                <FieldErrorMessage fieldId={groupFieldError.fieldId} message={groupFieldError.message} />
              )}
            </div>
          </div>

          {role === 'EMPLOYEE' && (
            <div className="form-group" data-testid="manager-field">
              <label htmlFor="tm-manager">{t('settings:memberModal.fields.reportsTo')}</label>
              <select
                id="tm-manager"
                value={managerId}
                onChange={(e) =>
                  setManagerId(e.target.value === '' ? '' : Number(e.target.value))
                }
              >
                <option value="">{t('settings:memberModal.fields.none')}</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id} dir="auto">
                    {m.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <fieldset className="approval-chain-fields" data-testid="approval-chain-fields">
            <legend>{t('settings:memberModal.approvals.title')}</legend>
            <p className="form-help">{t('settings:memberModal.approvals.help')}</p>
            {approvalApproverIds.map((selectedId, index) => (
              <div className="form-group" key={index}>
                <label htmlFor={`tm-approver-${index + 1}`}>
                  {t('settings:memberModal.approvals.level', { level: index + 1 })}
                  {index === 0 ? <span className="field-required"> *</span> : null}
                </label>
                <select
                  id={`tm-approver-${index + 1}`}
                  value={selectedId}
                  required={index === 0}
                  aria-invalid={approvalChainError || undefined}
                  aria-describedby={approvalChainError ? 'approval-chain-error' : undefined}
                  onChange={(event) => {
                    const value = event.target.value === '' ? '' : Number(event.target.value)
                    setApprovalApproverIds((current) => current.map((id, position) =>
                      position === index ? value : id,
                    ))
                    setApprovalChainTouched(true)
                    setApprovalChainError(false)
                  }}
                >
                  <option value="">
                    {index === 0
                      ? t('settings:memberModal.approvals.selectRequired')
                      : t('settings:memberModal.approvals.notUsed')}
                  </option>
                  {approverOptions.map((member) => (
                    <option
                      key={member.id}
                      value={member.id}
                      disabled={approvalApproverIds.some((id, position) =>
                        position !== index && id === member.id,
                      )}
                    >
                      {member.fullName} — {t(`settings:memberModal.roles.${
                        member.role === 'HR_ADMIN'
                          ? 'hrAdmin'
                          : member.role === 'MANAGER' ? 'manager' : 'employee'
                      }`)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {approvalChainError ? (
              <p id="approval-chain-error" className="field-error" role="alert">
                {t('settings:memberModal.approvals.invalid')}
              </p>
            ) : null}
          </fieldset>

          {cappedLeaveTypes.length > 0 && (
            <div className="form-group">
              <label>{t('settings:memberModal.fields.entitlements')}</label>
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

          {upgradePrompt && (
            <div className="upgrade-prompt" role="alert" tabIndex={-1} ref={upgradePromptRef} data-testid="plan-limit-banner">
              <div>
                <strong>{t('settings:memberModal.upgrade.title')}</strong>
                <p>{upgradePrompt.detail}</p>
                {upgradePrompt.checkoutUnavailable && (
                  <p>{t('settings:memberModal.upgrade.checkoutUnavailable')}</p>
                )}
                <p>{t('settings:memberModal.upgrade.manual')}</p>
              </div>
              <div className="upgrade-prompt-actions">
                <label htmlFor="upgrade-plan">{t('settings:memberModal.upgrade.paidPlan')}</label>
                <select
                  id="upgrade-plan"
                  value={upgradePlan}
                  onChange={(event) => setUpgradePlan(event.target.value as UpgradePlan)}
                >
                  <option value="STARTER">{t('settings:memberModal.plans.starter')}</option>
                  <option value="GROWTH">{t('settings:memberModal.plans.growth')}</option>
                </select>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleUpgrade}
                  disabled={checkoutMutation.isPending}
                  data-busy={checkoutMutation.isPending ? 'true' : undefined}
                  data-testid="cta-upgrade-path"
                >
                  {checkoutMutation.isPending
                    ? t('settings:memberModal.actions.opening')
                    : t('settings:memberModal.actions.upgrade')}
                </button>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              {t('common:actions.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isPending}
              data-busy={isPending ? 'true' : undefined}
            >
              {isPending ? t('common:actions.saving') : t('common:actions.save')}
            </button>
          </div>
        </form>
    </Modal>
  )
}

function isPlanLimitReached(err: unknown): err is ApiError {
  return err instanceof ApiError && err.problem.code === 'plan-limit-reached'
}

function teamMemberFieldErrors(fieldErrors: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter(([field]) => field in TEAM_MEMBER_FIELD_IDS),
  )
}

function translateFieldErrors(fieldErrors: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, message]) => [field, translateFieldViolation(field, message)]),
  )
}
