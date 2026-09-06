import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  getPublicHolidays,
  getRecentApprovalDecisions,
  getTeamMembers,
  getWorkforceGroups,
} from '../../api/client'
import type { UserSummaryResponse } from '../../api/generated/types'
import {
  CalendarIcon,
  CheckIcon,
  CloseIcon,
  PlusIcon,
  UserIcon,
} from '../../components/ui/icons'
import {
  getFirstUseStorageKey,
  loadFirstUseProgress,
  saveFirstUseProgress,
  type FirstUseProgress,
  type FirstUseStep,
} from './firstUseStorage'
import './first-use.css'

type FirstUseCueProps = {
  user: UserSummaryResponse
  onStartRequest: () => void
  onDismiss?: () => void
}

const STEP_ORDER: FirstUseStep[] = ['calendars', 'people', 'preview']

/**
 * Org signals for the first-use cue, resolved independently.
 *
 * Each field is `null` when its source call failed. A single failing endpoint must never
 * decide whether a brand-new Organization Admin sees onboarding at all: `Promise.all` used to reject
 * the whole query if one group's holiday fetch errored, which suppressed the cue for exactly
 * the person it exists for (Epic 11 retrospective action item 4).
 */
type FirstUseSignals = {
  hasPublicHoliday: boolean | null
  hasLeaveHistory: boolean | null
  activeMemberCount: number | null
  assignedActiveMemberCount: number | null
}

const valueOrNull = <T,>(result: PromiseSettledResult<T>): T | null =>
  result.status === 'fulfilled' ? result.value : null

async function getFirstUseOrganizationSignals(): Promise<FirstUseSignals> {
  const [groupsResult, membersResult, decisionsResult] = await Promise.allSettled([
    getWorkforceGroups(),
    getTeamMembers(),
    getRecentApprovalDecisions(),
  ])

  const groups = valueOrNull(groupsResult)
  const members = valueOrNull(membersResult)
  const recentDecisions = valueOrNull(decisionsResult)

  let hasPublicHoliday: boolean | null = null
  if (groups) {
    const holidayResults = await Promise.allSettled(
      groups.map((group) => getPublicHolidays(group.id)),
    )
    const resolved = holidayResults.filter((r) => r.status === 'fulfilled')
    // "No holidays anywhere" is only trustworthy if every group answered. If some group
    // failed we know a holiday exists (true) or we know nothing (null) — never a false
    // "nothing configured", which would wrongly mark the org immature.
    const anyHoliday = resolved.some(
      (r) => (r as PromiseFulfilledResult<unknown[]>).value.length > 0,
    )
    hasPublicHoliday = anyHoliday
      ? true
      : resolved.length === holidayResults.length
        ? false
        : null
  }

  const activeMembers = members?.filter(
    (member) => member.status !== 'DEACTIVATED',
  )

  return {
    hasPublicHoliday,
    hasLeaveHistory: recentDecisions ? recentDecisions.length > 0 : null,
    activeMemberCount: activeMembers ? activeMembers.length : null,
    assignedActiveMemberCount: activeMembers
      ? activeMembers.filter((member) => member.workforceGroupId != null).length
      : null,
  }
}

function stepHref(step: FirstUseStep): string | null {
  if (step === 'calendars') {
    return '/settings?category=working-calendars'
  }
  if (step === 'people') {
    return '/settings?category=people'
  }
  return null
}

export function FirstUseCue({
  user,
  onStartRequest,
  onDismiss,
}: FirstUseCueProps) {
  const { t } = useTranslation('dashboard')
  const storageKey = useMemo(
    () => getFirstUseStorageKey(user.organizationId, user.id),
    [user.id, user.organizationId],
  )
  const [progress, setProgress] = useState<FirstUseProgress>(() =>
    loadFirstUseProgress(storageKey),
  )

  const signalsQuery = useQuery({
    queryKey: ['first-use-signals', user.organizationId],
    queryFn: getFirstUseOrganizationSignals,
    enabled: user.role === 'ORGANIZATION_ADMIN' && storageKey !== null && !progress.dismissed,
    retry: false,
    staleTime: 5 * 60 * 1000,
    // The admin leaves for Settings and comes back; the cue has to notice what they changed.
    // Without this the 5-minute staleTime would keep reporting the pre-configuration state.
    refetchOnMount: 'always',
  })

  if (user.role !== 'ORGANIZATION_ADMIN' || !storageKey || progress.dismissed) {
    return null
  }

  // Step completion prefers authoritative setup evidence over "the user navigated there".
  // Clicking through to Settings used to mark Calendars/People done even if nothing was
  // configured, so the cue reported progress the organization had not actually made
  // (Epic 11 retrospective action item 4). Local progress remains a floor: a step already
  // recorded stays recorded even when its signal is temporarily unavailable.
  const signals = signalsQuery.isSuccess ? signalsQuery.data : null
  const effectiveSteps: Record<FirstUseStep, boolean> = {
    calendars: progress.steps.calendars || signals?.hasPublicHoliday === true,
    people:
      progress.steps.people || (signals?.assignedActiveMemberCount ?? 0) >= 2,
    // No server signal means "this admin opened the request preview" — org-wide leave
    // history is somebody else's activity, not this person's onboarding. AC7 defines the
    // action itself as the completion, so `preview` stays local.
    preview: progress.steps.preview,
  }

  const currentStepIndex = STEP_ORDER.findIndex((step) => !effectiveSteps[step])
  if (currentStepIndex === -1) {
    return null
  }

  // Org signals are org-scoped (recent-decisions/holidays/members), so a
  // newly invited Organization Admin with no personal history does not suppress the
  // mature-org check for the org they were invited into.
  let showCue = false
  if (signalsQuery.isSuccess) {
    const signals = signalsQuery.data
    // Suppression requires POSITIVE evidence on every signal. An unknown (null) signal must
    // not read as "mature" — hiding onboarding from a new admin is the costly error, while
    // showing it to an established org is a dismissible annoyance.
    const matureOrganization =
      signals.hasPublicHoliday === true &&
      signals.hasLeaveHistory === true &&
      (signals.activeMemberCount ?? 0) >= 2 &&
      (signals.assignedActiveMemberCount ?? 0) >= 2
    showCue = !matureOrganization
  } else if (signalsQuery.isError) {
    // Every source failed. Show the cue rather than hide it — an unstarted admin still needs
    // a way in, and a started admin keeps their place.
    showCue = true
  }

  if (!showCue) {
    return null
  }

  const progressStorageKey = storageKey
  const currentStep = STEP_ORDER[currentStepIndex]
  // Evidence can complete steps out of order (an org may have calendars configured but no
  // group assignments), so the displayed number tracks the step actually being shown rather
  // than a count of completions — otherwise the heading and the highlighted step disagree.
  const displayStepNumber = currentStepIndex + 1

  function persist(next: FirstUseProgress) {
    setProgress(saveFirstUseProgress(progressStorageKey, next))
  }

  function completeStep(step: FirstUseStep) {
    persist({
      ...progress,
      steps: {
        ...progress.steps,
        [step]: true,
      },
    })
  }

  function dismiss() {
    persist({ ...progress, dismissed: true })
    onDismiss?.()
  }

  function handleCurrentAction() {
    // Only `preview` completes on the action itself — AC7 defines opening the preview (not
    // submitting) as the completion, and there is no server-side signal for "opened a form".
    //
    // `calendars` and `people` deliberately do NOT complete here. Following the link only
    // means the admin looked at Settings; it is not evidence that a weekend pattern, holiday
    // or group assignment was actually configured. Those steps flip when the org signals say
    // so (see effectiveSteps), which is what Epic 11 retrospective action item 4 asked for:
    // separate navigation progress from domain completion.
    if (currentStep === 'preview') {
      onStartRequest()
      completeStep(currentStep)
    }
  }

  const href = stepHref(currentStep)

  return (
    <aside
      className="first-use-cue"
      data-testid="first-use-cue"
      aria-labelledby="first-use-title"
    >
      <div className="first-use-cue-header">
        <div>
          <p className="first-use-eyebrow">{t('firstUse.eyebrow')}</p>
          <h2 id="first-use-title" className="first-use-title">
            {t('firstUse.title')}
          </h2>
          <p className="first-use-summary">{t('firstUse.summary')}</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm first-use-dismiss"
          data-testid="first-use-dismiss"
          onClick={dismiss}
        >
          <CloseIcon size={16} aria-hidden="true" />
          {t('firstUse.dismiss')}
        </button>
      </div>

      <p className="first-use-progress">
        {t('firstUse.progress', {
          current: displayStepNumber,
          total: STEP_ORDER.length,
        })}
      </p>

      <ol className="first-use-steps">
        {STEP_ORDER.map((step, index) => {
          const complete = effectiveSteps[step]
          const current = index === currentStepIndex
          const StepIcon =
            step === 'calendars'
              ? CalendarIcon
              : step === 'people'
                ? UserIcon
                : PlusIcon

          return (
            <li
              key={step}
              className={[
                'first-use-step',
                current ? 'first-use-step-current' : '',
                complete ? 'first-use-step-complete' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-testid={`first-use-step-${index + 1}`}
              aria-current={current ? 'step' : undefined}
            >
              <span className="first-use-step-marker" aria-hidden="true">
                {complete ? (
                  <CheckIcon size={18} />
                ) : (
                  <StepIcon size={18} />
                )}
              </span>
              <span className="first-use-step-copy">
                <strong>{t(`firstUse.steps.${step}.title`)}</strong>
                <span>{t(`firstUse.steps.${step}.description`)}</span>
                <span className="first-use-step-status">
                  {complete
                    ? t('firstUse.status.complete')
                    : current
                      ? t('firstUse.status.current')
                      : t('firstUse.status.upcoming')}
                </span>
              </span>
            </li>
          )
        })}
      </ol>

      <div className="first-use-actions">
        {href ? (
          <Link
            className="btn btn-primary"
            data-testid="first-use-cta"
            to={href}
            onClick={handleCurrentAction}
          >
            {t(`firstUse.steps.${currentStep}.action`)}
          </Link>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            data-testid="first-use-cta"
            onClick={handleCurrentAction}
          >
            {t(`firstUse.steps.${currentStep}.action`)}
          </button>
        )}
        <span className="first-use-nonblocking">
          {t('firstUse.nonBlocking')}
        </span>
      </div>
    </aside>
  )
}
