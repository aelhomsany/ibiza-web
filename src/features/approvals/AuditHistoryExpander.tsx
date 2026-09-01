import { useState } from 'react'
import { AuditHistoryPanel } from './AuditHistoryPanel'
import { AuditHistoryToggle } from './AuditHistoryToggle'

type AuditHistoryExpanderProps = {
  requestId: number
  employeeName?: string
}

export function AuditHistoryExpander({
  requestId,
  employeeName,
}: AuditHistoryExpanderProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div data-testid={`audit-history-expander-${requestId}`}>
      <AuditHistoryToggle
        requestId={requestId}
        employeeName={employeeName}
        expanded={expanded}
        onToggle={() => setExpanded((open) => !open)}
      />
      {expanded ? (
        <AuditHistoryPanel
          requestId={requestId}
          panelId={`audit-history-${requestId}`}
        />
      ) : null}
    </div>
  )
}
