import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError, type OnboardingState } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { LoadingState } from '../../components/ui/LoadingState'
import { useToast } from '../../components/ui/useToast'
import { CheckIcon, RefreshCwIcon } from '../../components/ui/icons'
import { useOnboarding, useOnboardingPresentation } from './useOnboarding'
import { OnboardingProgress } from './OnboardingProgress'
import { clearOnboardingRedirectSkip, skipOnboardingRedirect } from './redirectPreference'
import { safeHref, withSetupReturn } from './stageRoutes'
import './onboarding.css'

type OnboardingPageProps = {
  state?: OnboardingState
  onRetryConflict?: () => void
  onAdvancePresentation?: () => void
  onSkip?: () => void
  isRefreshing?: boolean
}

/**
 * The provisioning-to-activation states AC3 requires the UI to keep distinct. Each is derived from
 * a separate server fact, so "workspace created" can never read as a completed first leave cycle.
 *
 * The six milestones are unchanged — they still back the funnel analytics — but they are named for
 * what the *user* did, not for the internal activation ladder. `dependsOnOthers` marks the step the
 * admin cannot complete alone, so it reads "Waiting for…" instead of sitting on their to-do list.
 */
function activationStages(state: OnboardingState) {
  const activated = state.activationStatus === 'COMMERCIALLY_ACTIVATED'
  const paid = state.plan === 'GROWTH'
  // Paid plan is not the same fact as paid invoice. The server sends `billingInOnboarding` for
  // exactly the recovery states (PENDING_PAYMENT, PAST_DUE_GRACE, RESTRICTED), so reading plan
  // alone told an Organization that had not paid, in the first person, that it had.
  const paymentSettled = state.billingInOnboarding !== true
  return [
    { key: 'registrationAccepted', reached: true, dependsOnOthers: false },
    { key: 'emailVerified', reached: true, dependsOnOthers: false },
    ...(paid ? [{ key: 'paymentConfirmed', reached: paymentSettled, dependsOnOthers: false }] : []),
    // Provisioning precedes setup and is blocked on nobody, so it is not a "waiting on your team"
    // step — labelling it that pointed the user forward at work the same list calls their own.
    { key: 'workspaceCreated', reached: state.workspaceCreated !== false, dependsOnOthers: false },
    { key: 'onboardingComplete', reached: state.onboardingComplete === true, dependsOnOthers: false },
    { key: 'commercialActivation', reached: activated, dependsOnOthers: true },
  ]
}

function stageStatusKey(stage: { key: string; reached: boolean; dependsOnOthers: boolean }): string {
  if (stage.reached) return 'onboarding:activation.reachedLabel'
  return stage.dependsOnOthers
    ? `onboarding:activation.waitingLabels.${stage.key}`
    : 'onboarding:activation.pendingLabel'
}

/**
 * Milestones whose first-person name only makes sense once reached — "You confirmed payment" is a
 * false statement while billing is still recovering, so an unreached row needs its own wording.
 *
 * Resolved in JS rather than through i18next `defaultValue`: this project's `parseMissingKeyHandler`
 * returns the empty string for a missing key, which takes precedence over `defaultValue` and would
 * silently blank the label.
 */
const PENDING_STATE_KEYS = new Set(['paymentConfirmed'])

function stageNameKey(stage: { key: string; reached: boolean }): string {
  return !stage.reached && PENDING_STATE_KEYS.has(stage.key)
    ? `onboarding:activation.pendingStates.${stage.key}`
    : `onboarding:activation.states.${stage.key}`
}

function remainingMilestoneKey(state: OnboardingState): string {
  if (!state.milestones?.invitationAccepted) return 'activation.remaining.invitation'
  if (!state.milestones.firstRequestSubmitted) return 'activation.remaining.request'
  if (!state.milestones.firstRequestApproved) return 'activation.remaining.approval'
  if (!state.milestones.reconciled) return 'activation.remaining.reconciliation'
  return 'activation.remaining.finalizing'
}

function OnboardingView({
  state,
  onRetryConflict,
  onAdvancePresentation,
  onSkip,
  isRefreshing = false,
}: Required<Pick<OnboardingPageProps, 'state'>> &
  Pick<OnboardingPageProps, 'onRetryConflict' | 'onAdvancePresentation' | 'onSkip' | 'isRefreshing'>) {
  const { t } = useTranslation(['onboarding', 'common'])
  const activated = state.activationStatus === 'COMMERCIALLY_ACTIVATED'
  // The kill switch withdraws the guided surface, so its fallback must not advertise a return to it.
  const nextHref = state.presentationEnabled === false
    ? safeHref(state.fallbackRoute)
    : withSetupReturn(safeHref(state.nextSafeAction?.href))

  return (
    <main className="page page-wide onboarding-page" data-testid="onboarding-page">
      <header className="page-header onboarding-header">
        <div>
          <p className="onboarding-eyebrow">{t('onboarding:eyebrow')}</p>
          <h1 className="page-title">{t('onboarding:title')}</h1>
          <p className="page-sub">{t('onboarding:subtitle')}</p>
        </div>
        {/*
          A background refetch swaps the evidence under the user. Announcing it here — in the live
          region that already exists — is what makes the returning-from-Settings update legible
          rather than a silent flicker between two different answers.

          No aria-busy on the region itself: it tells assistive tech to withhold live updates until
          it clears, which suppressed the very "checking…" message it was added to announce and let
          only the idle text through.
        */}
        <p
          className="onboarding-resume-status"
          data-testid="onboarding-resume-status"
          role="status"
        >
          {isRefreshing ? t('onboarding:refreshing') : t('onboarding:resumeStatus')}
        </p>
      </header>

      {state.conflict ? (
        <section
          className="onboarding-conflict"
          data-testid="onboarding-stale-conflict"
          aria-labelledby="onboarding-conflict-title"
        >
          <div>
            <h2 id="onboarding-conflict-title">{t('onboarding:conflict.title')}</h2>
            <p>{state.conflict.message || t('onboarding:conflict.body')}</p>
          </div>
          {Object.entries(state.conflict.recoverableInput ?? {}).map(([key, value]) => (
            <label key={key} className="onboarding-recoverable-input">
              <span>{t('onboarding:conflict.preservedInput')}</span>
              <input value={value} readOnly dir="auto" />
            </label>
          ))}
          <button type="button" className="btn btn-outline" onClick={onRetryConflict}>
            <RefreshCwIcon size={16} aria-hidden="true" />
            {t('common:actions.retry')}
          </button>
        </section>
      ) : null}

      <div className="onboarding-grid">
        <OnboardingProgress state={state} />

        <div className="onboarding-main-column">
          <section className="onboarding-action-card" aria-labelledby="onboarding-next-title">
            <p className="onboarding-card-eyebrow">{t('onboarding:next.eyebrow')}</p>
            <h2 id="onboarding-next-title">{t(`onboarding:next.actions.${state.nextSafeAction?.action ?? 'CONTINUE'}`)}</h2>
            <p>{t('onboarding:next.body')}</p>
            <div className="onboarding-action-row">
              <Link
                className="btn btn-primary onboarding-next-action"
                data-testid="onboarding-next-action"
                to={nextHref}
                onClick={onAdvancePresentation}
              >
                {state.presentationEnabled === false
                  ? t('onboarding:next.openSettings')
                  : t('onboarding:next.continue')}
              </Link>
              {/*
                Persisted opt-out. Sign-in used to divert every Organization Admin here until setup completed,
                so an admin who came to approve a request was overridden on every login.
              */}
              {onSkip ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  data-testid="onboarding-skip-action"
                  onClick={onSkip}
                >
                  {t('onboarding:next.notNow')}
                </button>
              ) : null}
            </div>
            {onSkip ? (
              <p className="onboarding-consent-note">{t('onboarding:next.notNowHint')}</p>
            ) : null}
            {state.analyticsConsent === 'NECESSARY_ONLY' ? (
              <p className="onboarding-consent-note">{t('onboarding:analyticsOptional')}</p>
            ) : null}
          </section>

          <section className="activation-card" aria-labelledby="activation-title">
            <p className="onboarding-card-eyebrow">{t('onboarding:activation.eyebrow')}</p>
            <h2 id="activation-title">{t('onboarding:activation.title')}</h2>
            {/*
              Says plainly that nothing is gated. The internal "Not commercially activated" framing
              read as a billing problem on an account that is, in fact, fully live.
            */}
            <p className="activation-reassurance" data-testid="activation-reassurance">
              {t('onboarding:activation.reassurance')}
            </p>
            <div className="activation-status" data-testid="activation-status" role="status">
              <strong>
                {activated
                  ? t('onboarding:activation.activated')
                  : t('onboarding:activation.notActivated')}
              </strong>
            </div>
            <ol className="activation-states" data-testid="activation-states">
              {activationStages(state).map((stage) => (
                <li
                  key={stage.key}
                  className={`activation-state${stage.reached ? ' is-reached' : stage.dependsOnOthers ? ' is-waiting' : ''}`}
                  data-testid={`activation-state-${stage.key}`}
                >
                  {stage.reached ? <CheckIcon size={16} aria-hidden="true" /> : null}
                  {/*
                    The first-person names assert the thing was done, so an unreached milestone
                    needs its own wording — "You confirmed payment / To do" contradicts itself.
                    Milestones with no pending variant keep the same name.
                  */}
                  <span>{t(stageNameKey(stage))}</span>
                  <span className="activation-state-label">{t(stageStatusKey(stage))}</span>
                </li>
              ))}
            </ol>
            {activated ? (
              <p className="activation-reached" data-testid="commercial-activation-reached">
                <CheckIcon size={18} aria-hidden="true" />
                {t('onboarding:activation.reached')}
              </p>
            ) : null}
            {/*
              The four reconciled facts stay on screen after activation too. Hiding them on success
              removed exactly the evidence that makes the milestone legible.
            */}
            <p className="activation-remaining" data-testid="activation-remaining-milestone">
              {activated
                ? t('onboarding:activation.evidenceSummary')
                : t(remainingMilestoneKey(state))}
            </p>
            <p className="activation-honesty">{t('onboarding:activation.honesty')}</p>
          </section>
        </div>
      </div>
    </main>
  )
}

/**
 * An Organization that predates guided onboarding keeps the Settings flow — but redirecting it to
 * the dashboard in silence was indistinguishable from a broken link. The toast host sits above the
 * router, so the notice survives the navigation it explains.
 */
function LegacyOrganizationRedirect() {
  const { t } = useTranslation('onboarding')
  const { showToast } = useToast()

  useEffect(() => {
    showToast(t('error.legacyOrganization'), 'warning')
  }, [showToast, t])

  return <Navigate to="/" replace />
}

function ServerOnboardingPage() {
  const { t } = useTranslation(['onboarding', 'common'])
  const navigate = useNavigate()
  const { user } = useAuth()
  const query = useOnboarding(true, { alwaysRefetch: true })
  const presentation = useOnboardingPresentation()

  // Once setup is finished the opt-out has nothing left to suppress, and keeping it would let a
  // decision about a completed workflow silently govern a later one.
  const settled = query.data?.onboardingComplete === true
  const userId = user?.id
  useEffect(() => {
    if (settled) clearOnboardingRedirectSkip(userId)
  }, [settled, userId])

  if (query.isPending) {
    return (
      <main className="page page-wide onboarding-page">
        <LoadingState label={t('onboarding:loading')} variant="skeleton" />
      </main>
    )
  }
  if (query.isError) {
    const status = query.error instanceof ApiError ? query.error.status : undefined
    // 404 means this Organization predates guided onboarding: it keeps the Settings flow rather
    // than being shown an error it can never clear.
    if (status === 404) {
      return <LegacyOrganizationRedirect />
    }
    // A 403 is permanent for this session. Offering Retry on it hands the user a button that can
    // only ever fail again.
    const permanent = status === 403
    return (
      <main className="page page-wide onboarding-page">
        <section className="onboarding-error" role="alert">
          <h1 className="page-title">
            {t(permanent ? 'onboarding:error.forbiddenTitle' : 'onboarding:error.title')}
          </h1>
          <p>{t(permanent ? 'onboarding:error.forbiddenBody' : 'onboarding:error.body')}</p>
          {permanent ? null : (
            <button type="button" className="btn btn-outline" onClick={() => void query.refetch()}>
              {t('common:actions.retry')}
            </button>
          )}
          <Link className="btn btn-primary" to="/settings">
            {t('onboarding:next.openSettings')}
          </Link>
        </section>
      </main>
    )
  }
  // The kill switch must actually withdraw the guided surface, not merely retarget one button.
  if (query.data.presentationEnabled === false) {
    return <Navigate to={safeHref(query.data.fallbackRoute)} replace />
  }
  const state = query.data
  return (
    <OnboardingView
      state={state}
      // isPending is already handled above by the skeleton; this is the remount/background re-read.
      isRefreshing={query.isFetching}
      onSkip={() => {
        skipOnboardingRedirect(user?.id)
        navigate('/', { replace: true })
      }}
      onRetryConflict={() => void query.refetch()}
      // Persisting the position is what makes the optimistic-lock version meaningful: without a
      // caller the 409 contract and its recovery UI were unreachable in the running app.
      onAdvancePresentation={() => {
        if (state.version === undefined || !state.nextSafeAction) return
        presentation.mutate({ version: state.version, presentationStep: state.nextSafeAction.stage })
      }}
    />
  )
}

export function OnboardingPage({
  state,
  onRetryConflict,
  onAdvancePresentation,
  onSkip,
  isRefreshing,
}: OnboardingPageProps = {}) {
  if (state) {
    return (
      <OnboardingView
        state={state}
        onRetryConflict={onRetryConflict}
        onAdvancePresentation={onAdvancePresentation}
        onSkip={onSkip}
        isRefreshing={isRefreshing}
      />
    )
  }
  return <ServerOnboardingPage />
}
