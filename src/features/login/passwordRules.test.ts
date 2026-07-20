import { describe, expect, it } from 'vitest'
import { evaluatePasswordRequirements, isPasswordStrong } from './passwordRules'

describe('passwordRules', () => {
  it('marks each rule independently as the password improves', () => {
    const weak = evaluatePasswordRequirements('Ab1!')
    expect(weak.find((r) => r.id === 'minLength')?.met).toBe(false)
    expect(weak.find((r) => r.id === 'letterAndNumber')?.met).toBe(true)
    expect(weak.find((r) => r.id === 'upperAndLower')?.met).toBe(true)
    expect(weak.find((r) => r.id === 'special')?.met).toBe(true)
    expect(isPasswordStrong('Ab1!')).toBe(false)

    expect(isPasswordStrong('NewPassword1!')).toBe(true)
  })

  it('[P1] recognizes Arabic-script letters and Arabic-Indic digits, not just ASCII', () => {
    // Arabic-Indic digit (١) satisfies letterAndNumber's digit check alongside an Arabic letter.
    const arabicLetterAndDigit = evaluatePasswordRequirements('كلمةمرور١')
    expect(arabicLetterAndDigit.find((r) => r.id === 'letterAndNumber')?.met).toBe(true)

    // An Arabic letter must not be miscounted as a "special" (symbol) character.
    const arabicOnly = evaluatePasswordRequirements('كلمةسر')
    expect(arabicOnly.find((r) => r.id === 'special')?.met).toBe(false)

    // A real symbol is still detected as special alongside Arabic letters.
    const arabicWithSymbol = evaluatePasswordRequirements('كلمةسر!')
    expect(arabicWithSymbol.find((r) => r.id === 'special')?.met).toBe(true)
  })
})
