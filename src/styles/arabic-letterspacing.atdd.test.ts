import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Arabic letterspacing contract.
 *
 * Arabic is a cursive script: its letters join, and `letter-spacing` inserts gaps into the
 * joins, so a letterspaced label reads as broken rather than as a label. `text-transform:
 * uppercase` is inert there too, the script being caseless, so an uppercase+tracked label
 * loses one differentiator and has the other actively work against it.
 *
 * The house rule is to pair any `letter-spacing` on translated chrome with a reset scoped to
 * the Arabic document — `html[lang='ar'] <selector> { letter-spacing: normal }`. It was already
 * followed in seven stylesheets, and quietly missed in six others until a sweep on 2026-09-01.
 *
 * Nothing rendered can catch a dropped guard: jsdom applies no stylesheets, so no component
 * test sees a computed letter-spacing, and CSS is neither type-checked nor linted here. This
 * test reads the CSS source instead, and it deliberately guards the RULE rather than the seven
 * selectors that sweep touched — a new unguarded `letter-spacing` fails it too.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const srcRoot = join(repoRoot, 'src')

/**
 * Selectors that carry a `letter-spacing` with no Arabic reset, on purpose. Each entry states
 * why, because a scan that flags these is a FALSE POSITIVE: the rule is about cursive joining
 * in translated text, not about the presence of a `letter-spacing` declaration. The test below
 * fails if one of these stops declaring `letter-spacing` at all, so the list cannot rot.
 */
const deliberatelyUnguarded: Record<string, string> = {
  '.billing-plan-badge':
    'Renders {subscription.plan} raw with no t() — an untranslated Latin enum (FREE | STARTER | ' +
    'GROWTH | INTERNAL). The tracking is intended Latin tracking, and a language-scoped reset ' +
    'would strip it from Latin glyphs.',
  '.balance-value':
    'Its visible content is aria-hidden digits ("17/20"); the prose beside it sits in an .sr-only ' +
    'sibling, where letter-spacing has no visual effect. Digits do not join in either script.',
  '.team-calendar-page .page-title':
    "Already covered: global.css's `html[lang='ar'] .page-title` outranks this on specificity " +
    '(0-2-1 vs 0-2-0). Verified in the running app — -0.3px resolves to normal under lang=ar.',
}

/** `dir="rtl"` is set if and only if `lang="ar"` (see src/i18n/documentLanguage.ts). */
const GUARD_PATTERN = /html\[(?:lang='ar'|dir='rtl')\]/

type Rule = { file: string; selector: string; declarations: string[] }

function cssFilesUnder(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry)
    if (statSync(path).isDirectory()) return cssFilesUnder(path)
    return path.endsWith('.css') ? [path] : []
  })
}

function parseRules(file: string): Rule[] {
  // Comments first: an unstripped comment ahead of a rule is captured as part of its selector.
  const source = readFileSync(file, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Rule[] = []
  // Selector and body both exclude braces, so this matches innermost blocks only — a rule
  // nested in @media is captured on its own, with the at-rule prelude left behind.
  for (const match of source.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    rules.push({
      file,
      selector: match[1].trim().replace(/\s+/g, ' '),
      declarations: match[2]
        .split(';')
        .map((declaration) => declaration.trim())
        .filter(Boolean),
    })
  }
  return rules
}

/** Custom properties (`--font-metric-letter-spacing: -0.03em`) are values, not applied tracking. */
function letterSpacingValue(rule: Rule): string | null {
  const declaration = rule.declarations.find((entry) => entry.startsWith('letter-spacing:'))
  return declaration ? declaration.slice('letter-spacing:'.length).trim() : null
}

function selectorParts(selector: string): string[] {
  return selector
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

const allRules = cssFilesUnder(srcRoot).flatMap(parseRules)

const guardedSelectors = new Set(
  allRules
    .filter((rule) => GUARD_PATTERN.test(rule.selector) && letterSpacingValue(rule) === 'normal')
    .flatMap((rule) =>
      selectorParts(rule.selector).map((part) => part.replace(GUARD_PATTERN, '').trim()),
    ),
)

/** Rules that apply real tracking to rendered text, excluding the Arabic resets themselves. */
const trackedRules = allRules.filter((rule) => {
  if (GUARD_PATTERN.test(rule.selector)) return false
  const value = letterSpacingValue(rule)
  return value !== null && value !== 'normal'
})

describe('Arabic letterspacing contract', () => {
  it('[P1] every letter-spacing on translated chrome has an Arabic reset', () => {
    const unguarded = trackedRules.flatMap((rule) =>
      selectorParts(rule.selector)
        .filter((part) => !guardedSelectors.has(part) && !(part in deliberatelyUnguarded))
        .map((part) => `${relative(repoRoot, rule.file).split(sep).join('/')}  ${part}`),
    )

    // Named rather than counted: the failure message has to say what to add, since the fix is
    // one rule and the reason it is needed is not obvious from the diff that broke it.
    expect(
      unguarded,
      'Arabic is cursive, so letter-spacing breaks glyph joining. Add, beside each rule:\n' +
        "  html[lang='ar'] <selector> { letter-spacing: normal; }\n" +
        'If the text is never Arabic (raw Latin API data, digits) add it to deliberatelyUnguarded ' +
        'in this file with the reason.',
    ).toEqual([])
  })

  it('[P1] keeps the deliberately-unguarded list honest', () => {
    const stillTracked = new Set(trackedRules.flatMap((rule) => selectorParts(rule.selector)))
    const stale = Object.keys(deliberatelyUnguarded).filter(
      (selector) => !stillTracked.has(selector),
    )

    // A selector that no longer sets letter-spacing needs no exemption, and leaving it here
    // would silently exempt the name if some future rule reintroduced tracking under it.
    expect(stale, 'These no longer declare letter-spacing — drop them from the list').toEqual([])
  })

  it('[P1] guards the shared table, rail, and calendar headings the 2026-09-01 sweep fixed', () => {
    // The rule above is the real contract; this pins the specific regressions that prompted it,
    // so a refactor that drops one of these named guards fails with the history attached.
    expect([...guardedSelectors].sort()).toEqual(
      expect.arrayContaining([
        '.calendar-agenda-heading',
        '.calendar-out-today-title',
        '.calendar-timeline-person-heading',
        '.dashboard-table th',
        '.my-leaves-section-title',
        '.onboarding-progress-group-title',
        '.support-note-title',
        '.working-day-result-label',
      ]),
    )
  })
})
