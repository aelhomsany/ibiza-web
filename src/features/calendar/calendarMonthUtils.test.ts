import { describe, expect, it } from 'vitest'
import { startOfWeek } from './calendarMonthUtils'

describe('startOfWeek', () => {
  it('[P1] defaults to a Sunday-start week when no weekend is configured', () => {
    // 2026-06-10 is a Wednesday.
    expect(startOfWeek('2026-06-10')).toBe('2026-06-07')
    expect(startOfWeek('2026-06-10', [])).toBe('2026-06-07')
  })

  it('[P1] starts a Saturday+Sunday weekend on Monday, so the weekend stays contiguous instead of wrapping across row edges', () => {
    expect(startOfWeek('2026-06-10', ['SATURDAY', 'SUNDAY'])).toBe('2026-06-08')
  })

  it('[P1] keeps a Friday+Saturday weekend contiguous instead of splitting it across columns', () => {
    // Friday+Saturday weekend means the week starts on Sunday.
    expect(startOfWeek('2026-06-10', ['FRIDAY', 'SATURDAY'])).toBe('2026-06-07')
  })

  it('[P1] starts the week the day after a single configured weekend day', () => {
    // Only Sunday is a weekend day -> week starts Monday.
    expect(startOfWeek('2026-06-10', ['SUNDAY'])).toBe('2026-06-08')
  })

  it('[P1] returns the same weekStart for every day within that week', () => {
    const days = ['2026-06-07', '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13']
    const weekendDays = ['FRIDAY', 'SATURDAY'] as const
    const starts = new Set(days.map((day) => startOfWeek(day, [...weekendDays])))
    expect(starts.size).toBe(1)
    expect([...starts][0]).toBe('2026-06-07')
  })
})
