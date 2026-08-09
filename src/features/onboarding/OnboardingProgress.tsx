import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { OnboardingStageId, OnboardingState } from '../../api/client'
import { CheckIcon } from '../../components/ui/icons'
import { isWaitingStage, stageHref } from './stageRoutes'

const stageTestIds: Record<OnboardingStageId, string> = {
  ORGANIZATION: 'onboarding-stage-organization',
  WORKING_CALENDARS: 'onboarding-stage-working-calendars',
  PEOPLE_AND_INVITATIONS: 'onboarding-stage-people',
  ENTITLEMENTS_AND_READINESS: 'onboarding-stage-entitlements',
  FIRST_LEAVE_CYCLE: 'onboarding-stage-first-leave-cycle',
}

type Stage = NonNullable<OnboardingState['stages']>[number]
type NumberedStage = { stage: Stage; number: number }

export function OnboardingProgress({ state }: { state: OnboardingState }) {
  const { t } = useTranslation('onboarding')
  const activated = state.activationStatus === 'COMMERCIALLY_ACTIVATED'
  const stages = state.stages ?? []

  // The marker keeps the stage's position in the full workflow, not its position within its group —
  // splitting the list must not renumber "First leave cycle" as step 1.
  const numbered: NumberedStage[] = stages.map((stage, index) => ({ stage, number: index + 1 }))
  const owned = numbered.filter((entry) => !isWaitingStage(entry.stage.id))
  const waiting = numbered.filter((entry) => isWaitingStage(entry.stage.id))

  // Counted over the stages the admin actually controls. Including one they cannot finish alone
  // would understate their progress against work that was never theirs.
  const completed = owned.filter((entry) => state.evidence?.[entry.stage.id]?.complete === true).length
  const percent = owned.length === 0 ? 0 : Math.round((completed / owned.length) * 100)

  function renderStage({ stage, number }: NumberedStage) {
    const evidence = state.evidence?.[stage.id]
    const complete = evidence?.complete === true
    const current = state.nextSafeAction?.stage === stage.id && !activated
    // The stage list is server-driven, so an id this build does not know is a live possibility
    // rather than a hypothetical. Without a fallback the row shipped `data-testid="undefined-link"`.
    const known = stage.id in stageTestIds
    const testId = known ? stageTestIds[stage.id] : 'onboarding-stage-unknown'
    return (
      <li
        key={stage.id}
        className={`onboarding-stage${current ? ' onboarding-stage-current' : ''}${complete ? ' onboarding-stage-complete' : ''}`}
        data-testid={testId}
      >
        {/*
          Every row is reachable, completed ones included — the domain never enforced the rail's
          order, and an admin who wanted to revisit a finished stage had no way in.

          aria-current sits on the link, not the <li>: the link is what a keyboard user focuses, and
          announcing "current step" on a wrapper they never land on told them nothing.
        */}
        <Link
          className="onboarding-stage-link"
          data-testid={`${testId}-link`}
          to={stageHref(stage.id)}
          aria-current={current ? 'step' : undefined}
        >
          <span className="onboarding-stage-marker" aria-hidden="true">
            {complete ? <CheckIcon size={18} /> : number}
          </span>
          <span className="onboarding-stage-copy">
            {/*
              Fallbacks resolved in JS, not via i18next `defaultValue`: this project's
              parseMissingKeyHandler returns '' for a missing key and takes precedence over
              defaultValue, so an unknown server stage id would render a nameless row.
            */}
            <strong>{known ? t(`stages.${stage.id}.title`) : stage.label}</strong>
            <span>{evidence?.summary ?? (known ? t(`stages.${stage.id}.description`) : '')}</span>
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
  }

  return (
    <nav className="onboarding-progress-card" aria-label={t('progressLabel')}>
      {owned.length > 0 ? (
        <div className="onboarding-progress-summary">
          {/*
            A count, not three status words. Five rows labelled Complete/Next/Upcoming gave no way
            to judge how much was left. The bar is decoration — the text carries the value.
          */}
          <p className="onboarding-progress-count" data-testid="onboarding-progress-count">
            {t('progressCount', { completed, total: owned.length })}
          </p>
          <div className="onboarding-progress-bar" aria-hidden="true">
            <span className="onboarding-progress-bar-fill" style={{ inlineSize: `${percent}%` }} />
          </div>
        </div>
      ) : null}

      {owned.length > 0 ? (
        <section className="onboarding-progress-group" aria-labelledby="onboarding-group-owned">
          <h2 id="onboarding-group-owned" className="onboarding-progress-group-title">
            {t('groups.yourSetup')}
          </h2>
          <ol className="onboarding-progress" data-testid="onboarding-progress">
            {owned.map(renderStage)}
          </ol>
        </section>
      ) : (
        /*
          An empty or all-waiting stage list used to render a labelled landmark containing nothing,
          and took `onboarding-progress` with it — so the E2E that waits on that id hung rather than
          failing usefully. The id stays put and carries the explanation instead.
        */
        <p className="onboarding-progress-empty" data-testid="onboarding-progress">
          {t('progressEmpty')}
        </p>
      )}

      {waiting.length > 0 ? (
        <section className="onboarding-progress-group" aria-labelledby="onboarding-group-waiting">
          <h2 id="onboarding-group-waiting" className="onboarding-progress-group-title">
            {t('groups.waitingOn')}
          </h2>
          <p className="onboarding-progress-group-note">{t('groups.waitingOnNote')}</p>
          <ol className="onboarding-progress" data-testid="onboarding-progress-waiting">
            {waiting.map(renderStage)}
          </ol>
        </section>
      ) : null}
    </nav>
  )
}
