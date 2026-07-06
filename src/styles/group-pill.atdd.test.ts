import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Story 7.6 ATDD red-phase scaffold — shared group-pill CSS extraction (CO-010).
 *
 * <p>Staged under generated-atdd; copy to {@code ../ibiza-web/src/styles/group-pill.atdd.test.ts}
 * during {@code bmad-dev-story}. Paths resolve from ibiza-web repo root via {@code import.meta.url}.
 *
 * <p>When {@code describe.skip} is removed before CSS extraction, all tests should fail:
 * {@code group-pill.css} missing, {@code main.tsx} not importing it,
 * {@code TeamCalendarPage} still imports {@code team-members.css}, and group-pill rules remain in Settings CSS.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const groupPillCssPath = join(repoRoot, 'src/styles/group-pill.css')
const mainTsxPath = join(repoRoot, 'src/main.tsx')
const teamCalendarPagePath = join(repoRoot, 'src/features/calendar/TeamCalendarPage.tsx')
const teamMembersCssPath = join(repoRoot, 'src/features/settings/team-members.css')

describe('group-pill CSS ATDD — Story 7.6', () => {
  it('[P0] defines shared .group-pill, .group-pill-us, and .group-pill-egypt in src/styles/group-pill.css', () => {
    expect(existsSync(groupPillCssPath)).toBe(true)
    const content = readFileSync(groupPillCssPath, 'utf-8')

    expect(content).toMatch(/\.group-pill\s*\{/)
    expect(content).toMatch(/\.group-pill-us\s*\{/)
    expect(content).toMatch(/\.group-pill-egypt\s*\{/)
    expect(content).toContain('var(--color-teal-tint)')
    expect(content).toContain('var(--color-group-us)')
    expect(content).toContain('var(--color-sage-tint)')
    expect(content).toContain('var(--color-group-egypt)')
    expect(content).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('[P0] loads group-pill.css globally from main.tsx after tokens.css', () => {
    const mainContent = readFileSync(mainTsxPath, 'utf-8')

    expect(mainContent).toMatch(/import\s+['"]\.\/styles\/group-pill\.css['"]/)
    const tokensIdx = mainContent.indexOf("import './styles/tokens.css'")
    const groupPillIdx = mainContent.indexOf("import './styles/group-pill.css'")
    expect(tokensIdx).toBeGreaterThanOrEqual(0)
    expect(groupPillIdx).toBeGreaterThan(tokensIdx)
  })

  it('[P0] TeamCalendarPage does not import settings team-members.css', () => {
    const pageContent = readFileSync(teamCalendarPagePath, 'utf-8')

    expect(pageContent).not.toMatch(/import\s+['"]\.\.\/settings\/team-members\.css['"]/)
  })

  it('[P0] team-members.css no longer defines group-pill rules', () => {
    const cssContent = readFileSync(teamMembersCssPath, 'utf-8')

    expect(cssContent).not.toMatch(/\/\*\s*----\s*Group pill\s*----\s*\*\//)
    expect(cssContent).not.toMatch(/\.group-pill-us\s*\{/)
    expect(cssContent).not.toMatch(/\.group-pill-egypt\s*\{/)
  })
})
