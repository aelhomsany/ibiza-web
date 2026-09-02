/**
 * Country inference for the registration form: which signal wins, and what happens when the
 * strongest one is missing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBrowserTimezone } from '../../auth/timezone'
import { COUNTRY_CODES, countryFromTimeZone, countryOptions, inferCountryCode } from './countries'

vi.mock('../../auth/timezone', () => ({ getBrowserTimezone: vi.fn(() => 'UTC') }))

const zone = vi.mocked(getBrowserTimezone)

function declareLanguages(languages: string[]) {
  Object.defineProperty(window.navigator, 'languages', { value: languages, configurable: true })
  Object.defineProperty(window.navigator, 'language', {
    value: languages[0] ?? '',
    configurable: true,
  })
}

describe('registration country inference', () => {
  afterEach(() => {
    vi.clearAllMocks()
    zone.mockReturnValue('UTC')
  })

  it('[P1] resolves canonical zones and the legacy aliases browsers actually report', () => {
    expect(countryFromTimeZone('Africa/Cairo')).toBe('EG')
    // Chrome reports Asia/Calcutta even on a machine set to Asia/Kolkata.
    expect(countryFromTimeZone('Asia/Calcutta')).toBe('IN')
    expect(countryFromTimeZone('Asia/Kolkata')).toBe('IN')
    expect(countryFromTimeZone('America/Argentina/Buenos_Aires')).toBe('AR')
    expect(countryFromTimeZone('Mars/Olympus_Mons')).toBeUndefined()
  })

  it('[P1] prefers where the machine is over what language it speaks', () => {
    // The case that matters: an en-US browser on a machine in Cairo is in Egypt, not the US.
    zone.mockReturnValue('Africa/Cairo')
    declareLanguages(['en-US', 'en'])
    expect(inferCountryCode('EG')).toBe('EG')

    zone.mockReturnValue('America/New_York')
    declareLanguages(['ar-EG', 'ar'])
    expect(inferCountryCode('EG')).toBe('US')
  })

  it('[P1] falls back to the declared language, then to the given default', () => {
    zone.mockReturnValue('UTC')
    declareLanguages(['en', 'en-GB'])
    expect(inferCountryCode('EG')).toBe('GB')

    declareLanguages(['en'])
    expect(inferCountryCode('EG')).toBe('EG')
  })

  it('[P1] offers every country, named and ordered for the reader', () => {
    const english = countryOptions('en')
    expect(english).toHaveLength(COUNTRY_CODES.length)
    expect(english.find((option) => option.code === 'EG')?.name).toBe('Egypt')
    expect(countryOptions('ar').find((option) => option.code === 'EG')?.name).toBe('مصر')

    const names = english.map((option) => option.name)
    expect(names).toEqual([...names].sort(new Intl.Collator('en').compare))
  })
})
