import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const srcRoot = join(repoRoot, 'src')
const featuresRoot = join(srcRoot, 'features')

const paths = {
  main: join(srcRoot, 'main.tsx'),
  tokens: join(srcRoot, 'styles/tokens.css'),
  card: join(srcRoot, 'styles/card.css'),
  dataTable: join(srcRoot, 'styles/data-table.css'),
  formFields: join(srcRoot, 'styles/form-fields.css'),
  dashboardCss: join(featuresRoot, 'dashboard/dashboard.css'),
  teamMembersCss: join(featuresRoot, 'settings/team-members.css'),
  approvalsCss: join(featuresRoot, 'approvals/approvals.css'),
  modalCss: join(srcRoot, 'components/ui/modal.css'),
  organizationsPage: join(featuresRoot, 'platform/OrganizationsPage.tsx'),
}

function filesUnder(root: string, predicate: (path: string) => boolean): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry)
    return statSync(path).isDirectory() ? filesUnder(path, predicate) : predicate(path) ? [path] : []
  })
}

describe('shared UI CSS boundaries — Story 10.11', () => {
  it('[P0] loads shared card, table, and form contracts globally after tokens', () => {
    const main = readFileSync(paths.main, 'utf-8')
    const imports = [
      "import './styles/tokens.css'",
      "import './styles/group-pill.css'",
      "import './styles/card.css'",
      "import './styles/data-table.css'",
      "import './styles/form-fields.css'",
      "import './styles/global.css'",
    ]

    imports.forEach((cssImport) => expect(main).toContain(cssImport))
    imports.slice(1).forEach((cssImport, index) => {
      expect(main.indexOf(cssImport)).toBeGreaterThan(main.indexOf(imports[index]))
    })
    expect(existsSync(paths.card)).toBe(true)
    expect(existsSync(paths.dataTable)).toBe(true)
    expect(existsSync(paths.formFields)).toBe(true)
  })

  it('[P0] keeps generic rules out of Dashboard and Settings feature stylesheets', () => {
    const dashboardCss = readFileSync(paths.dashboardCss, 'utf-8')
    const teamMembersCss = readFileSync(paths.teamMembersCss, 'utf-8')

    expect(dashboardCss).not.toMatch(
      /\.(?:card|card-header|card-title|table-wrap|dashboard-table|leave-type-tag|status-hint|decline-reason|working-caption|dashboard-empty-state|dashboard-error|dashboard-section-loading)\s*[{,]/,
    )
    expect(teamMembersCss).not.toMatch(/\.(?:form-group|form-row-2col|card-section-header|card-section-title)\s*[{,]/)
  })

  it('[P0] prevents every feature from importing another feature stylesheet', () => {
    const sourceFiles = filesUnder(featuresRoot, (path) => /\.(?:css|ts|tsx)$/.test(path))
    const violations: string[] = []

    sourceFiles.forEach((sourcePath) => {
      const sourceFeature = relative(featuresRoot, sourcePath).split(sep)[0]
      const source = readFileSync(sourcePath, 'utf-8')
      const importPattern = sourcePath.endsWith('.css')
        ? /@import\s+(?:url\(\s*)?['"]([^'"]+\.css)['"]/g
        : /import\s+['"]([^'"]+\.css)['"]/g
      for (const match of source.matchAll(importPattern)) {
        const targetPath = resolve(dirname(sourcePath), match[1])
        const targetRelative = relative(featuresRoot, targetPath)
        if (!targetRelative.startsWith(`..${sep}`)) {
          const targetFeature = targetRelative.split(sep)[0]
          if (targetFeature !== sourceFeature) {
            violations.push(`${relative(repoRoot, sourcePath)} -> ${match[1]}`)
          }
        }
      }
    })

    expect(violations).toEqual([])
  })

  it('[P0] rejects literal color fallbacks in feature CSS', () => {
    const cssFiles = filesUnder(featuresRoot, (path) => path.endsWith('.css'))
    // Flag var(--token, <literal>) fallbacks that hide a missing token — hex/rgb/hsl/named
    // colors, raw dimensions, keywords, etc. var(--token, var(--other-token)) is a legitimate
    // token-to-token fallback (e.g. inline --chip-bg custom properties) and must stay allowed.
    const literalFallback = /var\(\s*--[a-zA-Z0-9-]+\s*,\s*(?!\s*var\()[^)]+\)/
    const violations = cssFiles
      .filter((path) => literalFallback.test(readFileSync(path, 'utf-8')))
      .map((path) => relative(repoRoot, path))

    expect(violations).toEqual([])
  })

  it('[P1] centralizes modal backdrop colors and preserves the padding contract', () => {
    const tokens = readFileSync(paths.tokens, 'utf-8')
    const modalCss = readFileSync(paths.modalCss, 'utf-8')
    const approvalsCss = readFileSync(paths.approvalsCss, 'utf-8')

    expect(tokens).toMatch(/--color-modal-backdrop:\s*rgba\(0,\s*0,\s*0,\s*0\.45\)/)
    expect(tokens).toContain('--color-modal-backdrop-accent:')
    expect(modalCss).toMatch(/\.modal::backdrop\s*{[^}]*var\(--color-modal-backdrop\)/s)
    expect(modalCss).toMatch(
      /\.modal\.modal-backdrop-accent::backdrop\s*{[^}]*var\(--color-modal-backdrop-accent\)/s,
    )
    expect(modalCss).toContain('padding: 24px 32px;')
    expect(modalCss).not.toMatch(/background:\s*rgba?\(/)
    expect(approvalsCss).not.toContain('::backdrop')

    const featureCss = filesUnder(featuresRoot, (path) => path.endsWith('.css'))
      .map((path) => readFileSync(path, 'utf-8'))
      .join('\n')
    expect(featureCss).not.toMatch(
      /(?:^|})\s*[^{}]*\.modal(?![-\w])[^{}]*\{[^{}]*\bpadding(?:-block|-inline)?:/s,
    )
  })

  it('[P1] keeps production CSS on the single 900px breakpoint contract', () => {
    const cssFiles = filesUnder(srcRoot, (path) => path.endsWith('.css'))
    const violations = cssFiles
      .filter((path) => /700px/.test(readFileSync(path, 'utf-8')))
      .map((path) => relative(repoRoot, path))

    expect(violations).toEqual([])
  })

  it('[P1] gives Organizations cold-load card chrome through global ownership', () => {
    const organizationsPage = readFileSync(paths.organizationsPage, 'utf-8')
    const cardCss = readFileSync(paths.card, 'utf-8')
    const dataTableCss = readFileSync(paths.dataTable, 'utf-8')

    expect(organizationsPage).toContain('className="card table-wrap organizations-table-card"')
    expect(cardCss).toMatch(/\.card\s*[,{]/)
    expect(cardCss).toContain('box-shadow: var(--shadow-card)')
    expect(dataTableCss).toMatch(/\.table-wrap\s*\{/)
  })
})
