import type { ProblemDetail } from './generated/types'

export type FieldViolationMap = Record<string, string[]>

export type ValidationViolation = {
  field: string
  message: string
}

const VALIDATION_FAILED_TYPE = 'https://ibiza.app/errors/validation-failed'

export function parseFieldViolations(problem: ProblemDetail): FieldViolationMap | null {
  if (problem.type !== VALIDATION_FAILED_TYPE) {
    return null
  }

  const raw = problem.violations
  if (!Array.isArray(raw) || raw.length === 0) {
    return null
  }

  const map: FieldViolationMap = {}
  for (const entry of raw) {
    if (
      entry == null ||
      typeof entry !== 'object' ||
      typeof (entry as ValidationViolation).field !== 'string' ||
      typeof (entry as ValidationViolation).message !== 'string'
    ) {
      continue
    }
    const { field, message } = entry as ValidationViolation
    if (!map[field]) {
      map[field] = []
    }
    map[field].push(message)
  }

  return Object.keys(map).length > 0 ? map : null
}

export function getFieldErrorMessage(
  violations: FieldViolationMap | null | undefined,
  field: string,
): string | undefined {
  return violations?.[field]?.[0]
}

export function hasFieldViolations(
  fieldViolations: FieldViolationMap | null | undefined,
): boolean {
  return fieldViolations != null && Object.keys(fieldViolations).length > 0
}

export function fieldErrorsFromApiError(
  fieldViolations: FieldViolationMap | null | undefined,
): Record<string, string> | null {
  if (!hasFieldViolations(fieldViolations)) {
    return null
  }

  const next: Record<string, string> = {}
  for (const [field, messages] of Object.entries(fieldViolations!)) {
    if (messages[0]) {
      next[field] = messages[0]
    }
  }

  return Object.keys(next).length > 0 ? next : null
}

export const TEAM_MEMBER_FIELD_IDS: Record<string, string> = {
  fullName: 'tm-fullname',
  email: 'tm-email',
  department: 'tm-dept',
  role: 'tm-role',
  workforceGroupId: 'tm-group',
}

export const LEAVE_REQUEST_FIELD_IDS: Record<string, string> = {
  leaveTypeId: 'leave-type',
  dateFrom: 'leave-from-date',
  dateTo: 'leave-to-date',
  note: 'leave-note',
}
