import { describe, expect, it } from 'vitest'
import {
  chipColorStyle,
  hueFromSeed,
  meetsAa,
  pillColorStyle,
  stableHash,
} from './entityColor'

const SAMPLED_SEEDS = Array.from({ length: 24 }, (_, index) => `seed-${index * 15}`)

describe('entityColor ATDD — Story 10.5', () => {
  it('[P0] stableHash returns the same value for the same seed across calls', () => {
    expect(stableHash('workforce-group-7')).toBe(stableHash('workforce-group-7'))
    expect(stableHash(42)).toBe(stableHash(42))
    expect(stableHash('42')).toBe(stableHash('42'))
  })

  it('[P0] hueFromSeed stays within 0..359 and differs for different seeds', () => {
    for (const seed of SAMPLED_SEEDS) {
      const hue = hueFromSeed(seed)
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThanOrEqual(359)
    }

    const hues = new Set([1, 2, 3, 4, 5].map((id) => hueFromSeed(id)))
    expect(hues.size).toBeGreaterThan(1)
  })

  it('[P0] pillColorStyle exposes --pill-bg/--pill-fg and distinct backgrounds per group id', () => {
    const styleA = pillColorStyle(1)
    const styleB = pillColorStyle(2)

    expect(styleA['--pill-bg']).toBeTruthy()
    expect(styleA['--pill-fg']).toBeTruthy()
    expect(styleA['--pill-bg']).not.toBe(styleA['--pill-fg'])
    expect(styleA['--pill-bg']).not.toBe(styleB['--pill-bg'])
    expect(pillColorStyle(1)).toEqual(styleA)
  })

  it('[P0] chipColorStyle exposes --chip-bg/--chip-fg and distinct backgrounds per user id', () => {
    const styleA = chipColorStyle(2)
    const styleB = chipColorStyle(3)

    expect(styleA['--chip-bg']).toBeTruthy()
    expect(styleA['--chip-fg']).toBeTruthy()
    expect(styleA['--chip-bg']).not.toBe(styleA['--chip-fg'])
    expect(styleA['--chip-bg']).not.toBe(styleB['--chip-bg'])
    expect(chipColorStyle(2)).toEqual(styleA)
  })

  it('[P0] ids sharing a hue receive distinct hash-derived color variants', () => {
    expect(hueFromSeed(8)).toBe(hueFromSeed(110))
    expect(pillColorStyle(8)['--pill-bg']).not.toBe(pillColorStyle(110)['--pill-bg'])
    expect(chipColorStyle(8)['--chip-bg']).not.toBe(chipColorStyle(110)['--chip-bg'])
  })

  it('[P1] pill fg/bg pairs meet WCAG AA (>=4.5:1) for sampled hues', () => {
    for (const seed of SAMPLED_SEEDS) {
      const style = pillColorStyle(seed)
      expect(meetsAa(style['--pill-fg']!, style['--pill-bg']!)).toBe(true)
    }
  })

  it('[P1] chip fg/bg pairs meet WCAG AA (>=4.5:1) for sampled hues', () => {
    for (const seed of SAMPLED_SEEDS) {
      const style = chipColorStyle(seed)
      expect(meetsAa(style['--chip-fg']!, style['--chip-bg']!)).toBe(true)
    }
  })
})
