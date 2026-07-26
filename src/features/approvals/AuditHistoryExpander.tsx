import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuditHistoryPanel } from './AuditHistoryPanel'

type AuditHistoryExpanderProps = {
  requestId: number
  employeeName?: string
}

export function AuditHistoryExpander({
  requestId,
  employeeName,
}: AuditHistoryExpanderProps) {
  const { t } = useTranslation('approvals')
  const [expanded, setExpanded] = useState(false)

  return (
    <div data-testid={`audit-history-expander-${requestId}`}>
      <button
        type="button"
        className="audit-history-toggle"
        aria-expanded={expanded}
        aria-controls={`audit-history-${requestId}`}
        aria-label={
          employeeName
            ? expanded
              ? t('audit.hideFor', { name: employeeName })
              : t('audit.showFor', { name: employeeName })
            : undefined
        }
        onClick={() => setExpanded((open) => !open)}
      >
        {expanded ? t('audit.hide') : t('audit.show')}
      </button>
      {expanded ? (
        <AuditHistoryPanel
          requestId={requestId}
          panelId={`audit-history-${requestId}`}
        />
      ) : null}
    </div>
  )
}
