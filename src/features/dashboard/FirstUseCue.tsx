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

type FirstUseCueProps = {
  user: UserSummaryResponse
  onStartRequest: () => void
  onDismiss?: () => void
}

const STEP_ORDER: FirstUseStep[] = ['calendars', 'people', 'preview']

async function getFirstUseOrganizationSignals() {
  const [groups, members, recentDecisions] = await Promise.all([
    getWorkforceGroups(),
    getTeamMembers(),
    getRecentApprovalDecisions(),
  ])
  const holidayGroups = await Promise.all(
    groups.map((group) => getPublicHolidays(group.id)),
  )
  const activeMembers = members.filter(
    (member) => member.status !== 'DEACTIVATED',
  )

  return {
    hasPublicHoliday: holidayGroups.some((holidays) => holidays.length > 0),
    hasLeaveHistory: recentDecisions.length > 0,
    activeMemberCount: activeMembers.length,
    assignedActiveMemberCount: activeMembers.filter(
      (member) => member.workforceGroupId != null,
    ).length,
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
  const hasStarted = STEP_ORDER.some((step) => progress.steps[step])

  const signalsQuery = useQuery({
    queryKey: ['first-use-signals', user.organizationId],
    queryFn: getFirstUseOrganizationSignals,
    enabled: user.role === 'HR_ADMIN' && storageKey !== null && !progress.dismissed,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  if (user.role !== 'HR_ADMIN' || !storageKey || progress.dismissed) {
    return null
  }

  const currentStepIndex = STEP_ORDER.findIndex(
    (step) => !progress.steps[step],
  )
  if (currentStepIndex === -1) {
    return null
  }

  // Org signals are org-scoped (recent-decisions/holidays/members), so a
  // newly invited HR Admin with no personal history does not suppress the
  // mature-org check for the org they were invited into.
  let showCue = false
  if (signalsQuery.isSuccess) {
    const signals = signalsQuery.data
    const matureOrganization =
      signals.hasPublicHoliday &&
      signals.hasLeaveHistory &&
      signals.activeMemberCount >= 2 &&
      signals.assignedActiveMemberCount >= 2
    showCue = !matureOrganization
  } else if (signalsQuery.isError) {
    showCue = hasStarted
  }

  if (!showCue) {
    return null
  }

  const progressStorageKey = storageKey
  const currentStep = STEP_ORDER[currentStepIndex]
  const completedCount = STEP_ORDER.filter((step) => progress.steps[step]).length
  const displayStepNumber = Math.min(completedCount + 1, STEP_ORDER.length)

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
    // Fire the action before persisting: if opening the request modal throws,
    // the step must not already be recorded as done. AC7 marks `preview` on
    // opening the preview (not on submitting), so opening is the completion.
    if (currentStep === 'preview') {
      onStartRequest()
    }
    completeStep(currentStep)
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
          const complete = progress.steps[step]
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
