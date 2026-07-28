export const FIRST_USE_STORAGE_PREFIX = 'ibiza.firstUse.v1:'

export type FirstUseStep = 'calendars' | 'people' | 'preview'

export type FirstUseProgress = {
  steps: Record<FirstUseStep, boolean>
  dismissed?: boolean
  updatedAt?: string
}

export const EMPTY_FIRST_USE_PROGRESS: FirstUseProgress = {
  steps: {
    calendars: false,
    people: false,
    preview: false,
  },
}

export function getFirstUseStorageKey(
  organizationId: number | null | undefined,
  userId: number,
): string | null {
  if (organizationId == null) {
    return null
  }
  return `${FIRST_USE_STORAGE_PREFIX}${organizationId}:${userId}`
}

export function loadFirstUseProgress(key: string | null): FirstUseProgress {
  if (!key) {
    return EMPTY_FIRST_USE_PROGRESS
  }

  try {
    const stored = localStorage.getItem(key)
    if (!stored) {
      return EMPTY_FIRST_USE_PROGRESS
    }

    const parsed = JSON.parse(stored) as Partial<FirstUseProgress>
    const steps = parsed.steps
    if (
      !steps ||
      typeof steps.calendars !== 'boolean' ||
      typeof steps.people !== 'boolean' ||
      typeof steps.preview !== 'boolean'
    ) {
      return EMPTY_FIRST_USE_PROGRESS
    }

    return {
      steps: {
        calendars: steps.calendars,
        people: steps.people,
        preview: steps.preview,
      },
      dismissed: parsed.dismissed === true,
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    }
  } catch {
    return EMPTY_FIRST_USE_PROGRESS
  }
}

export function saveFirstUseProgress(
  key: string,
  progress: FirstUseProgress,
): FirstUseProgress {
  // Re-read and merge (rather than overwrite) so a stale tab's in-memory
  // state can never un-complete a step or un-dismiss the cue that another
  // tab already persisted. Steps and dismissal only ever move forward.
  const current = loadFirstUseProgress(key)
  const next: FirstUseProgress = {
    steps: {
      calendars: progress.steps.calendars || current.steps.calendars,
      people: progress.steps.people || current.steps.people,
      preview: progress.steps.preview || current.steps.preview,
    },
    dismissed: progress.dismissed === true || current.dismissed === true,
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(key, JSON.stringify(next))
  } catch {
    // First use is never a gate. Keep the in-memory progress and let the
    // destination action continue when storage is unavailable.
  }
  return next
}
