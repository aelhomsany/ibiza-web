import type { CSSProperties } from 'react'

export type EntityColorStyle = CSSProperties

/** Deterministic hash stable across sessions for the same seed. */
export function stableHash(seed: string | number): number {
  const str = String(seed)
  let hash = 0
  for (let i = 0; i < str.length; i += 1) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/** Maps any seed to a hue on 0..359. */
export function hueFromSeed(seed: string | number): number {
  return stableHash(seed) % 360
}

function hslString(h: number, s: number, l: number): string {
  return `hsl(${h} ${s}% ${l}%)`
}

function parseHsl(color: string): [number, number, number] | null {
  const match = /^hsl\(\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*\)$/.exec(color)
  if (!match) {
    return null
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const saturation = s / 100
  const lightness = l / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const intermediate = chroma * (1 - Math.abs(((h / 60) % 2) - 1))
  const match = lightness - chroma / 2
  let red = 0
  let green = 0
  let blue = 0

  if (h < 60) {
    red = chroma
    green = intermediate
  } else if (h < 120) {
    red = intermediate
    green = chroma
  } else if (h < 180) {
    green = chroma
    blue = intermediate
  } else if (h < 240) {
    green = intermediate
    blue = chroma
  } else if (h < 300) {
    red = intermediate
    blue = chroma
  } else {
    red = chroma
    blue = intermediate
  }

  return [red + match, green + match, blue + match]
}

function relativeLuminance(red: number, green: number, blue: number): number {
  const transform = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  return (
    0.2126 * transform(red) + 0.7152 * transform(green) + 0.0722 * transform(blue)
  )
}

export function contrastRatio(foreground: string, background: string): number {
  const fg = parseHsl(foreground)
  const bg = parseHsl(background)
  if (!fg || !bg) {
    return 1
  }

  const [fgRed, fgGreen, fgBlue] = hslToRgb(...fg)
  const [bgRed, bgGreen, bgBlue] = hslToRgb(...bg)
  const fgLuminance = relativeLuminance(fgRed, fgGreen, fgBlue)
  const bgLuminance = relativeLuminance(bgRed, bgGreen, bgBlue)
  const lighter = Math.max(fgLuminance, bgLuminance)
  const darker = Math.min(fgLuminance, bgLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

export function meetsAa(foreground: string, background: string): boolean {
  return contrastRatio(foreground, background) >= 4.5
}

function colorVariant(hash: number): number {
  return (hash % 3 + Math.floor(hash / 360) % 2) % 3
}

function ensurePillColors(hue: number, variant: number): { bg: string; fg: string } {
  const saturation = 38 + variant * 8
  const bg = hslString(hue, saturation, 90)
  for (let fgLightness = 30; fgLightness >= 18; fgLightness -= 1) {
    const fg = hslString(hue, saturation + 8, fgLightness)
    if (meetsAa(fg, bg)) {
      return { bg, fg }
    }
  }
  return { bg, fg: hslString(hue, saturation + 8, 18) }
}

function ensureChipColors(hue: number, variant: number): { bg: string; fg: string } {
  const saturation = 36 + variant * 8
  for (let bgLightness = 38; bgLightness >= 28; bgLightness -= 2) {
    const bg = hslString(hue, saturation, bgLightness)
    for (let fgLightness = 98; fgLightness >= 92; fgLightness -= 1) {
      const fg = hslString(hue, 15, fgLightness)
      if (meetsAa(fg, bg)) {
        return { bg, fg }
      }
    }
    const neutralFg = 'hsl(0 0% 98%)'
    if (meetsAa(neutralFg, bg)) {
      return { bg, fg: neutralFg }
    }
  }
  return { bg: hslString(hue, saturation, 28), fg: 'hsl(0 0% 98%)' }
}

export function pillColorStyle(seed: string | number): EntityColorStyle {
  const hash = stableHash(seed)
  const { bg, fg } = ensurePillColors(hash % 360, colorVariant(hash))
  return {
    '--pill-bg': bg,
    '--pill-fg': fg,
  } as CSSProperties
}

export function chipColorStyle(seed: string | number): EntityColorStyle {
  const hash = stableHash(seed)
  const { bg, fg } = ensureChipColors(hash % 360, colorVariant(hash))
  return {
    '--chip-bg': bg,
    '--chip-fg': fg,
  } as CSSProperties
}
