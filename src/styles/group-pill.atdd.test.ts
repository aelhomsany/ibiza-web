import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Story 7.6 / 10.5 — shared group-pill CSS uses hash-derived CSS custom properties.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const groupPillCssPath = join(repoRoot, 'src/styles/group-pill.css')
const mainTsxPath = join(repoRoot, 'src/main.tsx')
const teamCalendarPagePath = join(repoRoot, 'src/features/calendar/TeamCalendarPage.tsx')
const teamMembersCssPath = join(repoRoot, 'src/features/settings/team-members.css')

describe('group-pill CSS ATDD — Story 7.6 / 10.5', () => {
  it('[P0] defines shared .group-pill with --pill-bg/--pill-fg vars in src/styles/group-pill.css', () => {
    expect(existsSync(groupPillCssPath)).toBe(true)
    const content = readFileSync(groupPillCssPath, 'utf-8')

    expect(content).toMatch(/\.group-pill\s*\{/)
    expect(content).toMatch(/var\(--pill-bg[,)]/)
    expect(content).toMatch(/var\(--pill-fg[,)]/)
    expect(content).not.toMatch(/\.group-pill-us\s*[{,]/)
    expect(content).not.toMatch(/\.group-pill-egypt\s*[{,]/)
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
