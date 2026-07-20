export type PasswordRequirementId =
  | 'minLength'
  | 'letterAndNumber'
  | 'upperAndLower'
  | 'special'

export type PasswordRequirement = {
  id: PasswordRequirementId
  met: boolean
}

// Unicode-aware (\p{L}/\p{Nd}) so Arabic-script letters and Arabic-Indic
// digits (٠-٩) satisfy the letter/number and special-character checks the
// same way their ASCII equivalents do. "upperAndLower" tests true Unicode
// case (\p{Lu}/\p{Ll}) rather than A-Z/a-z only; Arabic has no letter case,
// so this requirement is inherently satisfied only via case-distinct
// characters (e.g. Latin/Cyrillic/Greek) mixed into the password.
export function evaluatePasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      id: 'minLength',
      met: password.length >= 8,
    },
    {
      id: 'letterAndNumber',
      met: /\p{L}/u.test(password) && /\p{Nd}/u.test(password),
    },
    {
      id: 'upperAndLower',
      met: /\p{Lu}/u.test(password) && /\p{Ll}/u.test(password),
    },
    {
      id: 'special',
      met: /[^\p{L}\p{Nd}]/u.test(password),
    },
  ]
}

export function isPasswordStrong(password: string): boolean {
  return evaluatePasswordRequirements(password).every((requirement) => requirement.met)
}
