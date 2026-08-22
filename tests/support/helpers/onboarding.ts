import type { BrowserContext } from '@playwright/test'

/**
 * Shared guided-onboarding browser fixture (Story 12.5).
 *
 * Extracted from `guided-onboarding.spec.ts` so the Epic 12 accessibility checkpoints in
 * `accessibility-completion.spec.ts` render the same onboarding state the story specs assert
 * against. Two hand-maintained copies of this payload would drift, and the checkpoint suite
 * would then be proving accessibility for a page shape that no longer ships.
 */
export type OnboardingStateOverrides = {
  activationStatus: 'NOT_ACTIVATED' | 'COMMERCIALLY_ACTIVATED'
  presentationEnabled?: boolean
  analyticsConsent?: 'NECESSARY_ONLY'
}

export const onboardingStages = [
  { id: 'ORGANIZATION', label: 'Organization' },
  { id: 'WORKING_CALENDARS', label: 'Working calendars' },
  { id: 'PEOPLE_AND_INVITATIONS', label: 'People and invitations' },
  { id: 'ENTITLEMENTS_AND_READINESS', label: 'Entitlements and readiness' },
  { id: 'FIRST_LEAVE_CYCLE', label: 'First leave cycle' },
]

export function onboardingResponse(overrides: Partial<OnboardingStateOverrides> = {}) {
  const activated = overrides.activationStatus === 'COMMERCIALLY_ACTIVATED'
  return {
    workflowVersion: '12.5-v1',
    stages: onboardingStages,
    evidence: {
      ORGANIZATION: { complete: true, summary: 'Organization details are ready', facts: {} },
      WORKING_CALENDARS: { complete: false, summary: 'Review groups, weekends, and holidays', facts: {} },
      PEOPLE_AND_INVITATIONS: { complete: false, summary: 'Invite and assign at least one teammate', facts: {} },
      ENTITLEMENTS_AND_READINESS: { complete: true, summary: 'Leave entitlements are ready', facts: {} },
      FIRST_LEAVE_CYCLE: { complete: activated, summary: 'Complete the first real leave cycle', facts: {} },
    },
    currentPresentationStep: 'PEOPLE_AND_INVITATIONS',
    nextSafeAction: activated
      ? { stage: 'FIRST_LEAVE_CYCLE', action: 'VIEW_WORKSPACE', href: '/' }
      : { stage: 'WORKING_CALENDARS', action: 'OPEN_WORKING_CALENDARS', href: '/settings?category=working-calendars' },
    version: 3,
    activationStatus: 'NOT_ACTIVATED',
    milestones: {
      invitationAccepted: activated,
      firstRequestSubmitted: activated,
      firstRequestApproved: activated,
      reconciled: activated,
    },
    workspaceCreated: true,
    onboardingComplete: activated,
    billingInOnboarding: false,
    plan: 'FREE',
    creationSource: 'SELF_SERVICE',
    presentationEnabled: true,
    fallbackRoute: '/settings?category=working-calendars',
    ...overrides,
  }
}

export async function mockAuthenticatedOnboarding(
  context: BrowserContext,
  state: () => ReturnType<typeof onboardingResponse>,
  locale: 'en' | 'ar' = 'en',
) {
  await context.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'e2e-token', refreshToken: 'e2e-refresh', tokenType: 'Bearer', expiresIn: 900 }),
    }),
  )
  await context.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: 42,
        email: 'hr@example.test',
        fullName: 'Onboarding HR',
        role: 'HR_ADMIN',
        organizationId: 7,
        organizationName: 'Onboarding Workspace',
        timezone: 'UTC',
        preferredLanguage: locale,
      }),
    }),
  )
  await context.route('**/api/v1/onboarding', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(state()) }),
  )
}
