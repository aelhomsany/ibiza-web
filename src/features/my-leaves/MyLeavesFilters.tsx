import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { STATUS_FILTERS, type MyLeavesStatusFilter } from './statusFilters'

type MyLeavesFiltersProps = {
  query: string
  status: MyLeavesStatusFilter
  resultCount: number | null
  onQueryChange: (query: string) => void
  onStatusChange: (status: MyLeavesStatusFilter) => void
}

function statusLabelKey(status: MyLeavesStatusFilter): string {
  if (status === 'ALL') {
    return 'leaves:filters.all'
  }
  return `common:status.${status.toLowerCase()}`
}

export function MyLeavesFilters({
  query,
  status,
  resultCount,
  onQueryChange,
  onStatusChange,
}: MyLeavesFiltersProps) {
  const { t } = useTranslation(['leaves', 'common'])

  // Announce the result count through a single polite live region, debounced
  // and suppressed on first render, so typing does not flood the SR queue with
  // one announcement per keystroke (UX-DR43 — one live-region owner).
  const [announcement, setAnnouncement] = useState('')
  const initialised = useRef(false)
  useEffect(() => {
    if (resultCount == null) {
      return
    }
    if (!initialised.current) {
      initialised.current = true
      return
    }
    const label = t('leaves:filters.results', { count: resultCount })
    const timer = window.setTimeout(() => setAnnouncement(label), 500)
    return () => window.clearTimeout(timer)
  }, [resultCount, t])

  // Rendered inside the Leave History card since the Dashboard merge
  // (2026-09-01): the visible "Find a request" heading became redundant next to
  // the card's own header, and the result count moved up into that header. The
  // section keeps an accessible name and the debounced live-region announcer.
  return (
    <section className="my-leaves-filters" aria-label={t('leaves:filters.title')}>
      <p
        className="sr-only"
        role="status"
        data-testid="my-leaves-result-announcer"
      >
        {announcement}
      </p>

      <div className="my-leaves-filter-controls">
        <fieldset className="my-leaves-status-fieldset">
          <legend>{t('leaves:filters.statusLegend')}</legend>
          <div
            className="my-leaves-status-segments"
            data-testid="my-leaves-status-filter"
          >
            {STATUS_FILTERS.map((filter) => (
              <button
                type="button"
                className="my-leaves-status-segment"
                aria-pressed={status === filter}
                key={filter}
                onClick={() => onStatusChange(filter)}
              >
                {t(statusLabelKey(filter))}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="form-group my-leaves-search-field">
          <label htmlFor="my-leaves-search">{t('leaves:filters.searchLabel')}</label>
          <input
            id="my-leaves-search"
            data-testid="my-leaves-search"
            type="search"
            value={query}
            placeholder={t('leaves:filters.searchPlaceholder')}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
          />
        </div>
      </div>
    </section>
  )
}
