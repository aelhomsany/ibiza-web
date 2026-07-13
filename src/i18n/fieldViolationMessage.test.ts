import { afterEach, describe, expect, it } from 'vitest'
import i18n from './config'
import { translateFieldViolation } from './fieldViolationMessage'

describe('translateFieldViolation', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('uses the active locale for known server field violations', async () => {
    await i18n.changeLanguage('ar')
    expect(translateFieldViolation('leaveTypeId', 'must not be null')).toBe('اختر نوع الإجازة')
  })

  it('preserves an unmapped server message as the fallback', () => {
    expect(translateFieldViolation('unknown', 'Raw server message')).toBe('Raw server message')
  })
})
