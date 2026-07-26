import './coverage-summary.css'

type CoverageSummaryProps = {
  label: string
  offToday: number
  workingFromHomeToday: number
  upcoming: number
  offLabel: string
  workingFromHomeLabel: string
  upcomingLabel: string
  stateLabel: string
  isLoading?: boolean
  loadingLabel?: string
  isPartial?: boolean
  partialLabel?: string
}

/**
 * Text-first coverage facts from caller-provided read models.
 * It deliberately owns no thresholds, availability math, or risk rules.
 */
export function CoverageSummary({
  label,
  offToday,
  workingFromHomeToday,
  upcoming,
  offLabel,
  workingFromHomeLabel,
  upcomingLabel,
  stateLabel,
  isLoading = false,
  loadingLabel,
  isPartial = false,
  partialLabel,
}: CoverageSummaryProps) {
  if (isLoading) {
    return (
      <div
        className="coverage-summary coverage-summary--loading"
        aria-label={label}
        aria-busy="true"
        role="status"
        data-testid="coverage-summary"
      >
        {loadingLabel}
      </div>
    )
  }

  return (
    <section
      className="coverage-summary"
      aria-label={label}
      data-testid="coverage-summary"
    >
      <dl className="coverage-summary-facts">
        <div>
          <dt>{offLabel}</dt>
          <dd>{offToday}</dd>
        </div>
        <div>
          <dt>{workingFromHomeLabel}</dt>
          <dd>{workingFromHomeToday}</dd>
        </div>
        <div>
          <dt>{upcomingLabel}</dt>
          <dd>{upcoming}</dd>
        </div>
      </dl>
      <p className="coverage-summary-state">
        {isPartial && partialLabel ? partialLabel : stateLabel}
      </p>
    </section>
  )
}
