import type { ReactNode } from 'react'
import './working-day-explainer.css'

export type WorkingDayExplainerState =
  | 'before-dates'
  | 'loading'
  | 'valid'
  | 'zero'
  | 'error'

export type ChargedWorkingDay = {
  date: string
  displayDate: string
  kind: 'charged'
  reason: string
}

export type WeekendWorkingDay = {
  date: string
  displayDate: string
  kind: 'weekend'
  reason: string
}

export type HolidayWorkingDay = {
  date: string
  displayDate: string
  kind: 'holiday'
  reason: string
}

export type WorkingDayEvidence =
  | ChargedWorkingDay
  | WeekendWorkingDay
  | HolidayWorkingDay

type WorkingDayExplainerProps = {
  state: WorkingDayExplainerState
  stateMessage: string
  resultLabel?: string
  policyLabel?: string
  excludedSummary?: string
  days?: readonly WorkingDayEvidence[]
  compact?: boolean
  detailsLabel?: string
  defaultExpanded?: boolean
  retryLabel?: string
  onRetry?: () => void
  className?: string
  footer?: ReactNode
}

function Evidence({
  days,
  policyLabel,
  excludedSummary,
}: Pick<WorkingDayExplainerProps, 'days' | 'policyLabel' | 'excludedSummary'>) {
  const chronologicalDays = [...(days ?? [])].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="working-day-evidence">
      {excludedSummary ? (
        <p className="working-day-excluded-summary">{excludedSummary}</p>
      ) : null}
      {chronologicalDays.length > 0 ? (
        <ol className="working-day-chips" data-testid="working-day-chips">
          {chronologicalDays.map((day) => (
            <li
              className={`working-day-chip working-day-chip--${day.kind}`}
              data-working-day-chip={day.kind}
              data-date={day.date}
              key={`${day.date}-${day.kind}`}
            >
              <bdi className="working-day-chip-date">{day.displayDate}</bdi>
              <span className="working-day-chip-reason">{day.reason}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {policyLabel ? (
        <p className="working-day-policy" data-testid="working-day-policy">
          {policyLabel}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Shared, presentation-only explanation for server-derived working-day results.
 * It never derives a total or classifies dates; callers pass API/stored values
 * and localized labels. Evidence is sorted by its ISO date without reversing
 * DOM order in RTL.
 */
export function WorkingDayExplainer({
  state,
  stateMessage,
  resultLabel,
  policyLabel,
  excludedSummary,
  days,
  compact = false,
  detailsLabel,
  defaultExpanded = false,
  retryLabel,
  onRetry,
  className,
  footer,
}: WorkingDayExplainerProps) {
  const classNames = [
    'working-day-explainer',
    `working-day-explainer--${state}`,
    compact ? 'working-day-explainer--compact' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (state === 'before-dates' || state === 'loading') {
    return (
      <section
        className={classNames}
        data-state={state}
        data-testid="working-day-explainer"
        aria-busy={state === 'loading' || undefined}
      >
        <p className="working-day-state-message" role="status">
          {stateMessage}
        </p>
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section className={classNames} data-state={state} data-testid="working-day-explainer">
        <div className="working-day-error" role="alert">
          <p>{stateMessage}</p>
          {retryLabel && onRetry ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
              {retryLabel}
            </button>
          ) : null}
        </div>
      </section>
    )
  }

  const hasEvidence = Boolean(days?.length || policyLabel || excludedSummary)
  const evidence = hasEvidence ? (
    <Evidence days={days} policyLabel={policyLabel} excludedSummary={excludedSummary} />
  ) : null

  return (
    <section className={classNames} data-state={state} data-testid="working-day-explainer">
      <div
        className="working-day-result"
        data-testid="working-day-result"
        role={state === 'zero' ? 'alert' : 'status'}
      >
        <p className="working-day-result-label">{resultLabel}</p>
        {state === 'zero' ? (
          <p className="working-day-zero-message">{stateMessage}</p>
        ) : null}
      </div>

      {compact && detailsLabel && evidence ? (
        <details className="working-day-details" open={defaultExpanded}>
          <summary>{detailsLabel}</summary>
          {evidence}
        </details>
      ) : (
        evidence
      )}

      {footer}
    </section>
  )
}
