import i18n from './config'

const FIELD_VIOLATION_KEYS: Record<string, Record<string, string>> = {
  fullName: { 'must not be blank': 'errors:fields.fullName.required' },
  email: { 'must be a well-formed email address': 'errors:fields.email.invalid' },
  leaveTypeId: { 'must not be null': 'errors:fields.leaveTypeId.required' },
  dateTo: { 'dateTo must be on or after dateFrom': 'errors:fields.dateTo.range' },
}

export function translateFieldViolation(field: string, message: string): string {
  const key = FIELD_VIOLATION_KEYS[field]?.[message]
  return key ? i18n.t(key) : message
}
