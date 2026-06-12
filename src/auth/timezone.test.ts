import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBrowserTimezone } from './timezone'

describe('getBrowserTimezone', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns IANA zone from Intl when available', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'Europe/London',
    } as Intl.ResolvedDateTimeFormatOptions)

    expect(getBrowserTimezone()).toBe('Europe/London')
  })

  it('falls back to UTC when timeZone is empty', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: '',
    } as Intl.ResolvedDateTimeFormatOptions)

    expect(getBrowserTimezone()).toBe('UTC')
  })

  it('falls back to UTC when Intl throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('unsupported')
    })

    expect(getBrowserTimezone()).toBe('UTC')
  })

  it('falls back to UTC when browser returns an offset string', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: '+08:00',
    } as Intl.ResolvedDateTimeFormatOptions)

    expect(getBrowserTimezone()).toBe('UTC')
  })

  it('falls back to UTC when browser returns a UTC-prefixed offset string', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'UTC+8',
    } as Intl.ResolvedDateTimeFormatOptions)

    expect(getBrowserTimezone()).toBe('UTC')
  })
})
