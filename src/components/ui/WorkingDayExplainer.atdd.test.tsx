import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Story 11.1 — WorkingDayExplainer shared primitive contract.
 */

const uiDir = dirname(fileURLToPath(import.meta.url))
const explainerTsx = join(uiDir, 'WorkingDayExplainer.tsx')
const explainerCss = join(uiDir, 'working-day-explainer.css')

describe('WorkingDayExplainer ATDD — Story 11.1', () => {
  it('[P0] WorkingDayExplainer.tsx and working-day-explainer.css exist', () => {
    expect(existsSync(explainerTsx)).toBe(true)
    expect(existsSync(explainerCss)).toBe(true)
  })

  it('[P0] component source declares result → chips → policy testids', () => {
    expect(existsSync(explainerTsx)).toBe(true)
    const source = readFileSync(explainerTsx, 'utf-8')

    expect(source).toContain('working-day-explainer')
    expect(source).toContain('working-day-result')
    expect(source).toContain('working-day-chips')
    expect(source).toContain('working-day-policy')
    expect(source).toContain('data-working-day-chip')
  })

  it('[P0] charged/excluded chip copy is text-labelled (not color-only)', () => {
    expect(existsSync(explainerTsx)).toBe(true)
    const source = readFileSync(explainerTsx, 'utf-8')

    expect(source).toMatch(/Charged/)
    expect(source).toMatch(/Weekend/)
    expect(source).toMatch(/Holiday/)
  })

  it('[P0] loading and error states are explicit (no guessed totals)', () => {
    expect(existsSync(explainerTsx)).toBe(true)
    const source = readFileSync(explainerTsx, 'utf-8')

    expect(source).toMatch(/state\s*[:=]|['"]loading['"]|['"]error['"]|['"]zero['"]/)
    expect(source).toMatch(/role=["']alert["']/)
  })
})
