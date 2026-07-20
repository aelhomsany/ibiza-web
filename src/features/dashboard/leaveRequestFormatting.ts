export function formatDate(iso: string, locale?: string): string {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateRange(from: string, to: string, locale?: string): string {
  if (from === to) {
    return formatDate(from, locale)
  }
  return `${formatDate(from, locale)} – ${formatDate(to, locale)}`
}
