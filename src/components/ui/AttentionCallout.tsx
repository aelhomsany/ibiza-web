import { useId, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertDiamondIcon,
  CheckCircleIcon,
  ClipboardListIcon,
} from './icons'
import './attention-callout.css'

export type AttentionCalloutTone = 'priority' | 'status' | 'calm' | 'error'

type AttentionCalloutProps = {
  eyebrow: string
  title: string
  description: string
  actionLabel?: string
  actionTo?: string
  onAction?: () => void
  count?: number
  tone?: AttentionCalloutTone
  isLoading?: boolean
  testId?: string
}

function toneIcon(tone: AttentionCalloutTone): ReactNode {
  if (tone === 'priority' || tone === 'error') {
    return <AlertDiamondIcon size={22} />
  }
  if (tone === 'status') {
    return <ClipboardListIcon size={22} />
  }
  return <CheckCircleIcon size={22} />
}

/**
 * One prioritized task class with one consequence and one action.
 * Callers own the role/business priority; this component owns shared chrome.
 */
export function AttentionCallout({
  eyebrow,
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  count,
  tone = 'calm',
  isLoading = false,
  testId = 'dashboard-attention',
}: AttentionCalloutProps) {
  const titleId = useId()
  const actionClassName =
    tone === 'priority'
      ? 'btn btn-primary attention-callout-action'
      : 'btn btn-outline attention-callout-action'

  return (
    <section
      className={`attention-callout attention-callout--${tone}`}
      aria-labelledby={titleId}
      aria-busy={isLoading || undefined}
      data-testid={testId}
    >
      <div className="attention-callout-marker" aria-hidden="true">
        {count != null ? (
          <span className="attention-callout-count">{count}</span>
        ) : (
          toneIcon(tone)
        )}
      </div>

      <div className="attention-callout-copy">
        <p className="attention-callout-eyebrow">{eyebrow}</p>
        <h2 id={titleId} className="attention-callout-title">
          {title}
        </h2>
        <p className="attention-callout-description">{description}</p>
      </div>

      {actionLabel && actionTo ? (
        <Link className={actionClassName} to={actionTo}>
          {actionLabel}
        </Link>
      ) : actionLabel && onAction ? (
        <button type="button" className={actionClassName} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  )
}
