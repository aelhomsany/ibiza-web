import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Story 10.5 ATDD — tenant-generic pill colors and legacy token removal (AUD-07).
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')

const read = (relPath: string) => readFileSync(join(repoRoot, relPath), 'utf-8')

describe('tenant-generic group/user colors ATDD — Story 10.5', () => {
  it('[P0] group-pill.css derives colors from --pill-bg/--pill-fg vars and drops US/Egypt classes', () => {
    const css = read('src/styles/group-pill.css')

    expect(css).toMatch(/\.group-pill\s*\{/)
    expect(css).toMatch(/var\(--pill-bg[,)]/)
    expect(css).toMatch(/var\(--pill-fg[,)]/)
    expect(css).not.toMatch(/\.group-pill-us\s*[{,]/)
    expect(css).not.toMatch(/\.group-pill-egypt\s*[{,]/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('[P0] groupPillClass.ts is deleted and no component imports it', () => {
    expect(existsSync(join(repoRoot, 'src/components/groupPillClass.ts'))).toBe(false)

    for (const consumer of [
      'src/features/settings/TeamMembersCard.tsx',
      'src/features/calendar/CalendarMonthGrid.tsx',
      'src/features/calendar/CalendarLegend.tsx',
    ]) {
      expect(read(consumer)).not.toMatch(/groupPillClass/)
    }
  })

  it('[P0] calendar.css drops the capped user-N palette in favor of --chip-bg/--chip-fg vars', () => {
    const css = read('src/features/calendar/calendar.css')

    expect(css).not.toMatch(/\.cal-event--user-\d/)
    expect(css).not.toMatch(/\.cal-user-dot--user-\d/)
    expect(css).toMatch(/\.cal-event[^-\w][\s\S]*?var\(--chip-bg[,)]/)
    expect(css).toMatch(/\.calendar-person-avatar[^-\w][\s\S]*?var\(--chip-bg[,)]/)
  })

  it('[P1] --color-group-us / --color-group-egypt tokens are removed and consumers migrated', () => {
    expect(read('src/styles/tokens.css')).not.toMatch(/--color-group-(us|egypt)/)

    expect(read('src/styles/global.css')).not.toMatch(/--color-group-egypt/)
    expect(read('src/features/platform/organizations-page.css')).not.toMatch(/--color-group-/)
    expect(read('src/features/dashboard/OutTodaySidebar.tsx')).not.toMatch(/--color-group-egypt/)
  })

  it('[P2] OutTodaySidebar avatars use the shared entityColor utility, not a local palette', () => {
    const sidebar = read('src/features/dashboard/OutTodaySidebar.tsx')

    expect(sidebar).toMatch(/from\s+['"]\.\.\/\.\.\/utils\/entityColor['"]/)
    expect(sidebar).toMatch(/chipColorStyle\(/)
    expect(sidebar).not.toMatch(/function\s+avatarColor/)
  })

  it('[P1] the legacy Story 7.6 scaffold no longer pins US/Egypt name-keyed assertions', () => {
    const legacy = read('src/styles/group-pill.atdd.test.ts')

    expect(legacy).not.toMatch(/expect\(content\)\.toMatch\(\/\\\.group-pill-us/)
    expect(legacy).not.toMatch(/toContain\('var\(--color-group-us\)'\)/)
  })
})
