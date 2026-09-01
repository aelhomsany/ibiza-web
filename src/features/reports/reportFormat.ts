import type { i18n as I18nInstance, TFunction } from 'i18next'

/**
 * Presentation helpers for server-owned report values.
 *
 * Every function here is display-only. None of them aggregates, sums, re-derives, or
 * reinterprets a value — the server owns all arithmetic (AD-4). They exist so that an
 * enum code, an empty collection, or a nested fact map reaches the HR administrator as
 * readable, localized text instead of `APPROVED`, an empty cell, or `[object Object]`.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const ENUM_CODE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/

export type ReportFormatContext = {
  t: TFunction
  i18n: I18nInstance
  /** IANA zone the server applied to this view; instants are rendered in it. */
  timeZone?: string
}

/**
 * Translate a server enum code, falling back to the raw code when no key exists.
 *
 * The fallback is deliberate: `parseMissingKeyHandler` returns an empty string for a
 * missing key, so calling `t()` unguarded would erase an unrecognized code rather than
 * show it. A code we have not localized yet is still evidence.
 */
export function formatEnum(context: ReportFormatContext, value: string): string {
  if (!ENUM_CODE.test(value)) return value
  const key = `reports:values.${value}`
  return context.i18n.exists(key) ? context.t(key) : value
}

/** Render a plain `YYYY-MM-DD` without letting a timezone shift it a day. */
export function formatDate(context: ReportFormatContext, value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(context.i18n.language, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(parsed)
}

/**
 * Render an instant in the report's applied timezone, not the viewer's.
 *
 * The page states one display timezone as authoritative evidence; formatting timestamps
 * in the browser's zone would contradict it for anyone travelling or working remotely.
 */
export function formatInstant(context: ReportFormatContext, value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return context.t('reports:notAvailable')
  try {
    return new Intl.DateTimeFormat(context.i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: context.timeZone,
    }).format(parsed)
  } catch {
    // An unknown zone id must not blank the evidence; fall back to the viewer's zone.
    return new Intl.DateTimeFormat(context.i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed)
  }
}

function isEmptyCollection(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0
  if (value !== null && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length === 0
  }
  return false
}

/**
 * Flatten an array or record into readable text, recursing into nested objects.
 *
 * `ExceptionReportRow.facts` and `BalanceSnapshotSummary.totalsByPresence` both hold
 * objects as values, so a single `String(entry)` pass renders `[object Object]`.
 */
export function formatCollection(context: ReportFormatContext, value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((entry) => formatValue(context, entry)).join(', ')
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => {
        const label = formatEnum(context, key)
        const nested = formatValue(context, entry)
        return `${label}: ${nested}`
      })
      .join(', ')
  }
  return String(value)
}

/**
 * Format any value drawn from a report row, summary, or applied view.
 *
 * An empty array or record resolves to the "Not available" placeholder rather than an
 * empty cell — a blank node is indistinguishable from a rendering failure, and it still
 * satisfies `toBeVisible()`, so it hides regressions as well as evidence.
 */
export function formatValue(context: ReportFormatContext, value: unknown): string {
  if (value == null || value === '') return context.t('reports:notAvailable')
  if (typeof value === 'boolean') {
    return value ? context.t('reports:values.yes') : context.t('reports:values.no')
  }
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    if (ISO_INSTANT.test(value)) return formatInstant(context, value)
    if (ISO_DATE.test(value)) return formatDate(context, value)
    return formatEnum(context, value)
  }
  if (isEmptyCollection(value)) return context.t('reports:notAvailable')
  return formatCollection(context, value)
}

export type SummaryBreakdownPart = {
  /** Metric key, for list identity; empty for a flat map's single value part. */
  key: string
  /**
   * Empty when the row's own name already carries the meaning: a flat map's single
   * value, and the nested count that leads its group ("Away 8", never "Away Rows 8").
   */
  label: string
  value: string
}

export type SummaryBreakdownRow = {
  key: string
  label: string
  /** Set when the key is a presence code, so the caller can render the shared badge. */
  presence: 'WFH' | 'OFF' | null
  parts: SummaryBreakdownPart[]
}

/**
 * Decompose a composite summary value into rows the caller can lay out, or `null` when the
 * value is a scalar and belongs in the ordinary display-number slot.
 *
 * `formatCollection` flattens these to one string, which is right for a table cell but wrong
 * for a summary tile: `totalsByPresence` arrived as a run-on line at headline size whose
 * separators were ambiguous, because the comma between two presences read exactly like the
 * commas inside one. Structure has to survive as far as the markup to be readable.
 *
 * Still display-only — no value is dropped, reordered by value, or summed (AD-4). The one
 * presentation liberty: a nested `rowCount` leads its group as an unlabelled headline
 * number, so it cannot land between labelled metrics if the server reorders its keys.
 */
export function summaryBreakdown(
  context: ReportFormatContext,
  value: unknown,
): SummaryBreakdownRow[] | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const entries = Object.entries(value as Record<string, unknown>)
  // An empty map is "Not available", which is a scalar answer, not a breakdown of nothing.
  if (entries.length === 0) return null
  return entries.map(([key, entry]) => ({
    key,
    label: formatEnum(context, key),
    presence: key === 'WFH' || key === 'OFF' ? key : null,
    parts:
      entry !== null && typeof entry === 'object' && !Array.isArray(entry)
        ? Object.entries(entry as Record<string, unknown>)
            .sort(([a], [b]) => (a === 'rowCount' ? -1 : b === 'rowCount' ? 1 : 0))
            .map(([metric, metricValue]) => ({
              key: metric,
              // The count is the group's headline number: "Away 8", not "Away Rows 8" —
              // a label next to the group's own name adds nothing. Its locale entries
              // (`summary.metric.rowCount`) were removed in lockstep with this literal.
              label: metric === 'rowCount' ? '' : metricLabel(context, metric),
              value: formatValue(context, metricValue),
            }))
        : [{ key: '', label: '', value: formatValue(context, entry) }],
  }))
}

/**
 * Label one metric inside a nested summary map.
 *
 * These keys are camelCase, so `formatEnum` rejects them and they reached the page raw —
 * "approvedUsage: 4". Same fallback rule as everywhere else here: an unlabelled key is still
 * evidence, so show it rather than let the missing-key handler blank it.
 */
function metricLabel(context: ReportFormatContext, metric: string): string {
  const key = `reports:summary.metric.${metric}`
  return context.i18n.exists(key) ? context.t(key) : metric
}

/** Render the server's deterministic ordering, including its tie-breakers. */
export function formatOrdering(
  context: ReportFormatContext,
  ordering: ReadonlyArray<{ field?: string; direction?: string }> | undefined,
): string {
  if (!ordering || ordering.length === 0) return context.t('reports:notAvailable')
  return ordering
    .map((entry) => {
      const fieldKey = `reports:sort.${entry.field}`
      const field = entry.field
        ? context.i18n.exists(fieldKey)
          ? context.t(fieldKey)
          : entry.field
        : context.t('reports:notAvailable')
      const direction = entry.direction ? formatEnum(context, entry.direction) : ''
      return direction ? `${field} (${direction})` : field
    })
    .join(' → ')
}
