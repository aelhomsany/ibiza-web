import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  getOnboarding,
  updateOnboardingPresentation,
  type OnboardingStageId,
  type OnboardingState,
} from '../../api/client'
import { useAuth } from '../../auth/useAuth'

/**
 * Scoped to the signed-in user. A bare `['onboarding']` key with a 30s staleTime could serve one
 * tenant's evidence to the next account signed in on the same browser inside that window.
 */
export function onboardingQueryKey(userId?: number | string) {
  return ['onboarding', userId ?? 'anonymous'] as const
}

/**
 * `alwaysRefetch` is for the guided page itself. Its whole promise is authoritative server
 * evidence, and it is returned to immediately after the user changed that evidence in Settings —
 * within the 30s staleTime, so React Query served the cached copy and the step they had just
 * finished still read as outstanding. No Settings mutation invalidates this key, so remount is the
 * only point where the page can re-read. Ambient consumers (the dashboard cue) keep the cache.
 */
export function useOnboarding(enabled = true, options: { alwaysRefetch?: boolean } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: onboardingQueryKey(user?.id),
    queryFn: getOnboarding,
    enabled,
    retry: false,
    staleTime: 30_000,
    refetchOnMount: options.alwaysRefetch ? 'always' : true,
  })
}

/**
 * Persists the presentation position with the optimistic-lock version the page was rendered from.
 * On 409 the server hands back the authoritative reload plus the step the user was on, so the
 * conflict banner can explain what changed instead of silently discarding their place.
 */
export function useOnboardingPresentation() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const key = onboardingQueryKey(user?.id)

  return useMutation({
    mutationFn: ({ version, presentationStep }: { version: number; presentationStep: OnboardingStageId }) =>
      updateOnboardingPresentation(version, presentationStep),
    onSuccess: (state) => {
      queryClient.setQueryData(key, state)
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        const authoritative = (error.problem as { onboarding?: OnboardingState }).onboarding
        if (authoritative) {
          queryClient.setQueryData(key, authoritative)
          return
        }
      }
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
