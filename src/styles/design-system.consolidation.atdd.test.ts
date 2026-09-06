import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Story 10.6 — badge/button taxonomy consolidation (AUD-08, AUD-09).
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const globalCssPath = join(repoRoot, 'src/styles/global.css')
const teamMembersCssPath = join(repoRoot, 'src/features/settings/team-members.css')
const approvalsCssPath = join(repoRoot, 'src/features/approvals/approvals.css')
const publicHolidaysCssPath = join(repoRoot, 'src/features/settings/public-holidays.css')
const authFormCssPath = join(repoRoot, 'src/features/login/auth-form.css')

describe('design-system consolidation ATDD — Story 10.6', () => {
  it('[P0] team-members.css uses role-badge taxonomy and has no .badge base selector', () => {
    expect(existsSync(teamMembersCssPath)).toBe(true)
    const content = readFileSync(teamMembersCssPath, 'utf-8')

    expect(content).not.toMatch(/\.badge\s*\{/)
    expect(content).not.toMatch(/\.badge-EMPLOYEE\s*\{/)
    expect(content).toMatch(/\.role-badge\s*\{/)
    expect(content).toMatch(/\.role-badge-EMPLOYEE\s*\{/)
    expect(content).toMatch(/\.role-badge-MANAGER\s*\{/)
    expect(content).toMatch(/\.role-badge-ORGANIZATION_ADMIN\s*\{/)
  })

  it('[P0] global.css defines consolidated button variants btn-danger, btn-ghost, btn-success, btn-danger-outline', () => {
    expect(existsSync(globalCssPath)).toBe(true)
    const content = readFileSync(globalCssPath, 'utf-8')

    expect(content).toMatch(/\.btn-danger\s*\{/)
    expect(content).toMatch(/\.btn-ghost\s*\{/)
    expect(content).toMatch(/\.btn-success\s*\{/)
    expect(content).toMatch(/\.btn-danger-outline\s*\{/)
    expect(content).toMatch(/\.badge\s*\{/)
    expect(content.indexOf('.btn-sm {')).toBeGreaterThan(content.indexOf('.btn-ghost {'))
    expect(content).toMatch(/\.btn:focus-visible\s*\{[^}]*box-shadow:/s)
  })

  it('[P1] approvals.css no longer declares btn-success / btn-danger-outline color rules', () => {
    const content = readFileSync(approvalsCssPath, 'utf-8')

    expect(content).not.toMatch(/\.btn-success\s*\{/)
    expect(content).not.toMatch(/\.btn-danger-outline\s*\{/)
  })

  it('[P1] public-holidays.css no longer defines holiday-btn-ghost', () => {
    const content = readFileSync(publicHolidaysCssPath, 'utf-8')

    expect(content).not.toMatch(/\.holiday-btn-ghost\s*\{/)
  })

  it('[P1] auth-form.css auth-submit is layout-only (no standalone color block)', () => {
    const content = readFileSync(authFormCssPath, 'utf-8')

    if (content.includes('.auth-submit')) {
      expect(content).not.toMatch(/\.auth-submit\s*\{[^}]*background\s*:/s)
      expect(content).not.toMatch(/\.auth-submit:hover:not\(:disabled\)/)
    }
    expect(content).toMatch(/\.btn-block\s*\{/)
    expect(content).toMatch(/\.btn-block\s*\{[^}]*justify-content:\s*center/s)
  })
})
