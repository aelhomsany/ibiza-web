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

  return (
    <section
      className="card my-leaves-filters"
      aria-labelledby="my-leaves-filters-title"
    >
      <div className="my-leaves-filter-heading">
        <div>
          <p className="my-leaves-eyebrow">{t('leaves:filters.eyebrow')}</p>
          <h2 id="my-leaves-filters-title" className="my-leaves-filter-title">
            {t('leaves:filters.title')}
          </h2>
        </div>
        {resultCount == null ? null : (
          <p className="my-leaves-result-count" data-testid="my-leaves-result-count">
            {t('leaves:filters.results', { count: resultCount })}
          </p>
        )}
      </div>

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
