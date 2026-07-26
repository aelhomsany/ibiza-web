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

  it('defines the Coastal Clarity semantic, type, shape, and interaction families', () => {
    const content = readFileSync(tokensPath, 'utf-8')

    const requiredTokens = [
      '--color-surface-canvas: #F2F7F4',
      '--color-surface-card: #FFFEFB',
      '--color-text-primary: #133B45',
      '--color-border-default: #D7E5DF',
      '--color-action-primary: #073D48',
      '--color-focus-outer: #073D48',
      '--color-working-charged: #0C5961',
      '--color-working-excluded: #EEF2EF',
      '--color-working-policy: #275F55',
      '--color-auth-proof-glow: #C8EEE0',
      '--color-data-ocean: #3A91AA',
      '--color-nav-background: #0A3C49',
      '--font-page-title-size: 32px',
      '--font-section-title-size: 22px',
      '--font-card-title-size: 16px',
      '--font-body-size: 15px',
      '--font-label-size: 13px',
      '--font-caption-size: 12px',
      '--font-metric-size: 36px',
      '--radius-lg: 14px',
      '--space-page-mobile: 16px',
      '--min-touch-target: 44px',
    ]

    requiredTokens.forEach((token) => expect(content).toContain(token))
    expect(content).toContain("--font-family: 'Avenir Next'")
    expect(content).toContain('--shadow-focus-ring:')
  })
})
