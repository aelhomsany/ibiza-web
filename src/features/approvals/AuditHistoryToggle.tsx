import { useTranslation } from 'react-i18next'

type AuditHistoryToggleProps = {
  requestId: number
  employeeName?: string
  expanded: boolean
  onToggle: () => void
}

/**
 * The disclosure button on its own, so the panel it controls can be placed somewhere the
 * button is not. Inside the Recent Decisions table the panel belongs in a full-width row
 * beneath the record, not in the audit cell — that cell sits ~700px into a table wider
 * than a phone, so a panel rendered there opened entirely outside a 375px viewport.
 *
 * `AuditHistoryExpander` keeps the button and panel together for the callers that want
 * them together (My Leaves, Request context).
 */
export function AuditHistoryToggle({
  requestId,
  employeeName,
  expanded,
  onToggle,
}: AuditHistoryToggleProps) {
  const { t } = useTranslation('approvals')

  return (
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
      onClick={onToggle}
    >
      {expanded ? t('audit.hide') : t('audit.show')}
    </button>
  )
}
