import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Story 11.1 — Coastal Clarity visual foundation contract.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const srcRoot = join(repoRoot, 'src')

const paths = {
  tokens: join(srcRoot, 'styles/tokens.css'),
  global: join(srcRoot, 'styles/global.css'),
  dataTable: join(srcRoot, 'styles/data-table.css'),
  layout: join(srcRoot, 'styles/layout.css'),
  formFields: join(srcRoot, 'styles/form-fields.css'),
  modal: join(srcRoot, 'components/ui/modal.css'),
  toast: join(srcRoot, 'components/ui/toast.css'),
  appHeader: join(srcRoot, 'components/layout/app-header.css'),
  sidebar: join(srcRoot, 'components/layout/sidebar.css'),
  userMenu: join(srcRoot, 'components/layout/user-menu.css'),
  languageSwitcher: join(srcRoot, 'components/layout/language-switcher.css'),
  authForm: join(srcRoot, 'features/login/auth-form.css'),
  notifications: join(srcRoot, 'features/notifications/notifications.css'),
  requestLeave: join(srcRoot, 'features/dashboard/request-leave.css'),
  approvals: join(srcRoot, 'features/approvals/approvals.css'),
  workingDayExplainer: join(srcRoot, 'components/ui/working-day-explainer.css'),
}

const sharedChromeCss = [
  paths.global,
  paths.formFields,
  paths.modal,
  paths.toast,
  paths.sidebar,
  paths.authForm,
]

const touchedFoundationCss = [
  paths.global,
  paths.dataTable,
  paths.layout,
  paths.formFields,
  paths.modal,
  paths.toast,
  paths.appHeader,
  paths.sidebar,
  paths.userMenu,
  paths.languageSwitcher,
  paths.authForm,
  paths.notifications,
  paths.requestLeave,
  paths.approvals,
  paths.workingDayExplainer,
]

/** Single 3px --color-focus-ring shadow override (banned after dual-ring unification). */
const singleFocusOverride = /box-shadow:\s*0\s+0\s+0\s+3px\s+var\(--color-focus-ring\)/
const physicalInlineLayout =
  /\b(?:left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(?:left|right)|\brow-reverse\b/

describe('Coastal Clarity foundation ATDD — Story 11.1', () => {
  it('[P0] tokens.css exposes Coastal Clarity semantic color families', () => {
    expect(existsSync(paths.tokens)).toBe(true)
    const content = readFileSync(paths.tokens, 'utf-8')

    const required = [
      '--color-surface-canvas',
      '--color-surface-card',
      '--color-surface-subtle',
      '--color-text-primary',
      '--color-text-secondary',
      '--color-border-default',
      '--color-action-primary',
      '--color-working-charged',
      '--color-working-excluded',
      '--color-working-policy',
      '--color-auth-proof-glow',
      '--color-data-ocean',
      '--color-error-border',
      '--color-nav-background',
    ]

    required.forEach((token) => {
      expect(content, `missing ${token}`).toContain(token)
    })

    // Coastal warm-white card surface (not pure #FFFFFF as the only card token)
    expect(content).toMatch(/--color-surface-card:\s*#FFFEFB/i)
  })

  it('[P0] tokens.css exposes Coastal typography roles and radius-lg 14px', () => {
    const content = readFileSync(paths.tokens, 'utf-8')

    expect(content).toMatch(/--radius-lg:\s*14px/)
    expect(content).toContain('--font-page-title-size')
    expect(content).toContain('--font-section-title-size')
    expect(content).toContain('--font-metric-size')
    expect(content).toContain('--font-label-size')
    expect(content).toMatch(/--font-body-size:\s*15px/)
    expect(content).toMatch(/Avenir Next/)
    expect(content).toContain('--space-page-mobile')
    expect(content).toContain('--min-touch-target')
  })

  it('[P0] shared chrome has no single 3px --color-focus-ring focus overrides', () => {
    const violations = sharedChromeCss
      .filter((path) => existsSync(path) && singleFocusOverride.test(readFileSync(path, 'utf-8')))
      .map((path) => relative(repoRoot, path))

    expect(violations).toEqual([])
  })

  it('[P1] data-table.css defines comfortable 56px and compact 48px row tiers', () => {
    const content = readFileSync(paths.dataTable, 'utf-8')

    expect(content).toMatch(/min-height:\s*56px/)
    expect(content).toMatch(/(?:compact|table-row-compact)[\s\S]*min-height:\s*48px/)
  })

  it('[P1] layout.css wires page-mobile padding token for narrow screens', () => {
    const content = readFileSync(paths.layout, 'utf-8')

    expect(content).toContain('--space-page-mobile')
    expect(content).toMatch(/@media\s*\(\s*max-width:\s*900px\s*\)/)
  })

  it('[P1] mobile app header keeps the compact language switcher visible', () => {
    const content = readFileSync(paths.languageSwitcher, 'utf-8')

    expect(content).toContain(
      '.app-header-actions > .language-switcher:not(.language-switcher--compact)',
    )
    expect(content).toMatch(/\.language-switcher--compact\s*\{[\s\S]*display:\s*block/)
  })

  it('[P1] touched foundation CSS uses logical inline layout properties', () => {
    const violations = touchedFoundationCss
      .filter((path) => physicalInlineLayout.test(readFileSync(path, 'utf-8')))
      .map((path) => relative(repoRoot, path))

    expect(violations).toEqual([])
  })

  it('[P1] reduced-motion mode suppresses non-essential shared transitions', () => {
    const content = readFileSync(paths.global, 'utf-8')

    expect(content).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/)
    expect(content).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
    expect(content).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
  })
})
