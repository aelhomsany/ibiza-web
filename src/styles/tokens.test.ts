import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const tokensPath = join(dirname(fileURLToPath(import.meta.url)), 'tokens.css')

describe('tokens.css', () => {
  it('defines required color tokens from DESIGN.md', () => {
    const content = readFileSync(tokensPath, 'utf-8')

    expect(content).toContain('--color-teal')
    expect(content).toContain('--color-sidebar-deep')
    expect(content).toContain('--color-mist')
    expect(content).toContain('--color-surface-muted: #EEF2F4')
    expect(content).toContain('--color-modal-backdrop: rgba(0, 0, 0, 0.45)')
    expect(content).toContain('--color-modal-backdrop-accent:')
    expect(content).toContain('--layout-sidebar-width: 240px')
  })
})
