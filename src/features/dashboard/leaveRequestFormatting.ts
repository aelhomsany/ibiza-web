export function formatDate(iso: string): string {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateRange(from: string, to: string): string {
  if (from === to) {
    return formatDate(from)
  }
  return `${formatDate(from)} – ${formatDate(to)}`
}
