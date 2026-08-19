import { useTranslation } from 'react-i18next'
import type { ApprovalStepEvidenceResponse } from '../../api/generated/types'
import './ApprovalProgress.css'

type Props = {
  evidence?: ApprovalStepEvidenceResponse[]
  compact?: boolean
}

export function ApprovalProgress({ evidence = [], compact = false }: Props) {
  const { t } = useTranslation('approvals')
  if (evidence.length === 0) return null

  return (
    <section
      className={`approval-progress${compact ? ' approval-progress--compact' : ''}`}
      aria-label={t('progress.label')}
      data-testid="approval-progress"
    >
      <ol>
        {evidence.map((step) => {
          const displayedStatus = step.result ?? step.status
          return <li key={step.level} data-current={step.current ? 'true' : undefined}>
            <span className="approval-progress-level">
              {t('progress.level', { level: step.level })}
            </span>
            <strong>{step.nominalApproverFullName}</strong>
            <span>{t(`progress.status.${displayedStatus}`, { defaultValue: displayedStatus })}</span>
            {step.actedOnBehalf && step.actualActorFullName ? (
              <small>{t('progress.onBehalf', { name: step.actualActorFullName })}</small>
            ) : null}
            {step.note ? <p dir="auto">{step.note}</p> : null}
          </li>
        })}
      </ol>
    </section>
  )
}
