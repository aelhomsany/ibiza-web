import { useState } from 'react'
import { AuditHistoryPanel } from './AuditHistoryPanel'

type AuditHistoryExpanderProps = {
  requestId: number
}

export function AuditHistoryExpander({ requestId }: AuditHistoryExpanderProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div data-testid={`audit-history-expander-${requestId}`}>
      <button
        type="button"
        className="audit-history-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        {expanded ? 'Hide audit history' : 'Audit history'}
      </button>
      {expanded ? <AuditHistoryPanel requestId={requestId} /> : null}
    </div>
  )
}
