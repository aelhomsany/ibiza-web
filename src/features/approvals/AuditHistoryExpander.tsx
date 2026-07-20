import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuditHistoryPanel } from './AuditHistoryPanel'

type AuditHistoryExpanderProps = {
  requestId: number
}

export function AuditHistoryExpander({ requestId }: AuditHistoryExpanderProps) {
  const { t } = useTranslation('approvals')
  const [expanded, setExpanded] = useState(false)

  return (
    <div data-testid={`audit-history-expander-${requestId}`}>
      <button
        type="button"
        className="audit-history-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        {expanded ? t('audit.hide') : t('audit.show')}
      </button>
      {expanded ? <AuditHistoryPanel requestId={requestId} /> : null}
    </div>
  )
}
