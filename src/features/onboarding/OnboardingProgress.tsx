import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { OnboardingStageId, OnboardingState } from '../../api/client'
import { CheckIcon } from '../../components/ui/icons'
import { stageHref } from './stageRoutes'

const stageTestIds: Record<OnboardingStageId, string> = {
  ORGANIZATION: 'onboarding-stage-organization',
  WORKING_CALENDARS: 'onboarding-stage-working-calendars',
  PEOPLE_AND_INVITATIONS: 'onboarding-stage-people',
  ENTITLEMENTS_AND_READINESS: 'onboarding-stage-entitlements',
  FIRST_LEAVE_CYCLE: 'onboarding-stage-first-leave-cycle',
}

export function OnboardingProgress({ state }: { state: OnboardingState }) {
  const { t } = useTranslation('onboarding')
  const activated = state.activationStatus === 'COMMERCIALLY_ACTIVATED'
  const stages = state.stages ?? []

  return (
    <nav className="onboarding-progress-card" aria-label={t('progressLabel')}>
      <ol className="onboarding-progress" data-testid="onboarding-progress">
        {stages.map((stage, index) => {
          const evidence = state.evidence?.[stage.id]
          const complete = evidence?.complete === true
          const current = state.nextSafeAction?.stage === stage.id && !activated
          return (
            <li
              key={stage.id}
              className={`onboarding-stage${current ? ' onboarding-stage-current' : ''}${complete ? ' onboarding-stage-complete' : ''}`}
              data-testid={stageTestIds[stage.id]}
              aria-current={current ? 'step' : undefined}
            >
              {/*
                Every row is reachable, completed ones included — the domain never enforced the
                rail's order, and an admin who wants to revisit a finished stage had no way in.
              */}
              <Link
                className="onboarding-stage-link"
                data-testid={`${stageTestIds[stage.id]}-link`}
                to={stageHref(stage.id, state.nextSafeAction)}
              >
                <span className="onboarding-stage-marker" aria-hidden="true">
                  {complete ? <CheckIcon size={18} /> : index + 1}
                </span>
                <span className="onboarding-stage-copy">
                  <strong>{t(`stages.${stage.id}.title`, { defaultValue: stage.label })}</strong>
                  <span>{evidence?.summary ?? t(`stages.${stage.id}.description`)}</span>
                  <small>
                    {complete
                      ? t('status.complete')
                      : current
                        ? t('status.next')
                        : t('status.upcoming')}
                  </small>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
