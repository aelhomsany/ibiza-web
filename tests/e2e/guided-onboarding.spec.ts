import type { BrowserContext, Page } from '@playwright/test'
import { test, expect } from '../support/fixtures'
import { apiRequest } from '../support/helpers/api-client'
import { loginViaApi, loginViaUi, navigateInApp } from '../support/helpers/auth'
import { tags } from '../support/tags'

type OnboardingState = {
  activationStatus: 'NOT_ACTIVATED' | 'COMMERCIALLY_ACTIVATED'
  presentationEnabled?: boolean
  analyticsConsent?: 'NECESSARY_ONLY'
}

const stages = [
  { id: 'ORGANIZATION', label: 'Organization' },
  { id: 'WORKING_CALENDARS', label: 'Working calendars' },
  { id: 'PEOPLE_AND_INVITATIONS', label: 'People and invitations' },
  { id: 'ENTITLEMENTS_AND_READINESS', label: 'Entitlements and readiness' },
  { id: 'FIRST_LEAVE_CYCLE', label: 'First leave cycle' },
]

function response(overrides: Partial<OnboardingState> = {}) {
  const activated = overrides.activationStatus === 'COMMERCIALLY_ACTIVATED'
  return {
    workflowVersion: '12.5-v1',
    stages,
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

async function mockAuthenticatedOnboarding(
  context: BrowserContext,
  state: () => ReturnType<typeof response>,
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

async function expectNoPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
}

test.describe(
  'Guided onboarding resume — Story 12.5',
  { tag: [tags.regression, tags.uiOnly, tags.story('12-5')] },
  () => {
    test(
      '[P0] Given an HR Admin exits mid-setup, When they return on another session, Then onboarding opens the next evidence-based safe action',
      async ({ browser }) => {
        for (const locale of ['en', 'ar'] as const) {
          for (const width of [390, 768, 900, 901, 1280, 1440]) {
            const context = await browser.newContext({ viewport: { width, height: 900 } })
            await mockAuthenticatedOnboarding(context, () => response(), locale)
            const page = await context.newPage()
            await page.goto('/onboarding')

            await expect(page.getByTestId('onboarding-progress')).toBeVisible()
            // `from=onboarding` is what lets the destination offer the way back (SetupReturnNotice).
            await expect(page.getByTestId('onboarding-next-action')).toHaveAttribute(
              'href',
              '/settings?category=working-calendars&from=onboarding',
            )
            // aria-current sits on the link, not the row: the link is what a keyboard user focuses.
            await expect(page.getByTestId('onboarding-stage-working-calendars-link')).toHaveAttribute(
              'aria-current',
              'step',
            )
            await expectNoPageOverflow(page)
            if (locale === 'ar') {
              await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
              await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
            }
            await context.close()
          }
        }
      },
    )
  },
)

test.describe(
  'Commercial Activation — Story 12.5',
  { tag: [tags.regression, tags.uiOnly, tags.story('12-5')] },
  () => {
    test(
      '[P0] Given the real domain flow reconciles server-side, When onboarding refreshes, Then UI distinguishes unique Commercial Activation from workspace creation',
      async ({ browser }) => {
        let activated = false
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
        await mockAuthenticatedOnboarding(context, () => response({
          activationStatus: activated ? 'COMMERCIALLY_ACTIVATED' : 'NOT_ACTIVATED',
        }))
        const page = await context.newPage()
        await page.goto('/onboarding')

        // Reframed 2026-08-05 to the user's goal. The two states are now distinct phrases rather
        // than one being a substring of the other, which is what let the old assertion pass on the
        // exact state it claimed to distinguish.
        await expect(page.getByTestId('activation-status')).toContainText(/first leave cycle hasn't run yet/i)
        await expect(page.getByTestId('activation-reassurance')).toContainText(/nothing is restricted/i)
        await expect(page.getByTestId('activation-remaining-milestone')).toBeVisible()
        activated = true
        await page.reload()

        await expect(page.getByTestId('commercial-activation-reached')).toBeVisible()
        await expect(page.getByTestId('activation-status')).not.toContainText(/hasn't run yet/i)
        await expect(page.getByTestId('activation-status')).toContainText(/first leave cycle is complete/i)
        await expect(page.getByTestId('activation-state-commercialActivation')).toBeVisible()
        // Workspace creation stays on screen and stays a separate milestone after the cycle
        // completes. The previous assertion aimed at this but targeted `activation-status`, whose
        // text can never contain "workspace" — so it could only ever fail.
        await expect(page.getByTestId('activation-state-workspaceCreated')).toBeVisible()
        await expectNoPageOverflow(page)
        await context.close()
      },
    )

    test(
      '[P0] Given Necessary Only analytics preference, When onboarding continues by keyboard, Then zero task failures occur',
      async ({ browser }) => {
        const context = await browser.newContext()
        await mockAuthenticatedOnboarding(context, () => response({ analyticsConsent: 'NECESSARY_ONLY' }))
        const page = await context.newPage()
        await page.goto('/onboarding')

        const nextAction = page.getByTestId('onboarding-next-action')
        await nextAction.focus()
        await page.keyboard.press('Enter')
        await expect(page).toHaveURL(/\/settings\?category=working-calendars/)
        // The loop closes: the card tells the user to return afterward, so the destination has to
        // offer the way back — onboarding has no sidebar entry to fall back on.
        await expect(page.getByTestId('setup-return-notice')).toBeVisible()
        await expect(page.getByTestId('setup-return-action')).toHaveAttribute('href', '/onboarding')
        await expect(page.getByText(/enable analytics|analytics required/i)).toHaveCount(0)
        await context.close()
      },
    )

    test(
      '[P1] Given the return notice mounts on every org route, When the destination is viewed at each breakpoint in either locale, Then no page-level horizontal overflow occurs',
      async ({ browser }) => {
        // AC5/L7 hold for the banner too: it is shell-mounted, so it changes the layout of Settings,
        // My Leaves, Approvals, and Calendar rather than only the guided page.
        for (const locale of ['en', 'ar'] as const) {
          for (const width of [390, 768, 900, 901, 1280, 1440]) {
            const context = await browser.newContext({ viewport: { width, height: 900 } })
            await mockAuthenticatedOnboarding(context, () => response(), locale)
            const page = await context.newPage()
            await page.goto('/settings?category=working-calendars&from=onboarding')

            await expect(page.getByTestId('setup-return-notice')).toBeVisible()
            await expect(page.getByTestId('setup-return-dismiss')).toBeVisible()
            await expectNoPageOverflow(page)
            if (locale === 'ar') {
              await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
            }
            await context.close()
          }
        }
      },
    )

    test(
      '[P1] Given the marker rides in a bookmarkable URL, When the admin dismisses the return notice, Then it stays dismissed for the tab session',
      async ({ browser }) => {
        const context = await browser.newContext()
        await mockAuthenticatedOnboarding(context, () => response())
        const page = await context.newPage()
        await page.goto('/settings?category=working-calendars&from=onboarding')

        await page.getByTestId('setup-return-dismiss').click()
        await expect(page.getByTestId('setup-return-notice')).toBeHidden()

        // Same tab, marker still in the URL — a reload must not resurrect it.
        await page.reload()
        await expect(page.getByTestId('setup-return-notice')).toBeHidden()
        await context.close()
      },
    )
  },
)

/**
 * Story 12.5 ONBOARDING-VAL-014, API-backed.
 *
 * The UI-only describes above intentionally stub the API — they cover presentation, resume and
 * layout. This describe exists because VAL-014 is a P0 row whose only evidence used to be a
 * stubbed test titled "Given the real domain flow reconciles server-side": it intercepted
 * `/api/v1/onboarding` and flipped a local boolean, so it asserted a server-side reconciliation
 * it never performed. Nothing here is intercepted; every value rendered comes from the API.
 *
 * Causation of a *first* activation is proven at the API layer, by
 * OnboardingWorkflowIntegrationTest#realInviteRequestApprovalAndReconciliationActivateExactlyOnceWithoutSensitivePayload
 * — a browser cannot accept an invitation, because invitation tokens are hashed at rest and
 * delivered by email. What this proves is the half only a browser can: that the onboarding
 * surface renders the server's real evidence, and that the activation surface is self-consistent.
 */
test.describe(
  'Commercial Activation, API-backed — Story 12.5',
  { tag: [tags.regression, tags.api, tags.story('12-5')] },
  () => {
    test.skip(
      process.env.E2E_API_AVAILABLE !== 'true',
      'Set E2E_API_AVAILABLE=true when ibiza-api is running (scripts/run-e2e-with-api.sh)',
    )

    test(
      '[P0] Given the real onboarding endpoint, When an HR Admin opens onboarding, Then the rendered evidence is the server’s and the activation surface never contradicts itself',
      async ({ page, request }) => {
        // Onboarding is HR-Admin-only (the shared pilot identity is a MANAGER and gets a 403),
        // and the Organization must be guided-onboarding-eligible — the older demo orgs are
        // correctly refused by the eligibility gate. DemoScenarioSeeder provisions Meridian Labs
        // through OrganizationProvisioningCore for exactly this.
        const hrAdmin = {
          email: process.env.E2E_HR_ADMIN_EMAIL ?? 'morgan@meridian-labs.example',
          password: process.env.E2E_USER_PASSWORD ?? 'PilotDev123!',
        }
        const session = await loginViaApi(request, hrAdmin)
        const state = await apiRequest<{
          activationStatus: 'NOT_ACTIVATED' | 'COMMERCIALLY_ACTIVATED'
          nextSafeAction: { stage: string; action: string; href: string }
          milestones: Record<string, boolean>
          stages: { id: string }[]
        }>({
          request,
          method: 'GET',
          path: '/api/v1/onboarding',
          token: session.accessToken,
        })

        // The contradiction this story fixes: an activated Organization must never be told to
        // approve its first request again, whatever later happened to the qualifying request.
        if (state.activationStatus === 'COMMERCIALLY_ACTIVATED') {
          expect(state.nextSafeAction.action).not.toBe('APPROVE_FIRST_REQUEST')
          expect(state.milestones.firstRequestApproved).toBe(true)
        }
        expect(state.stages).toHaveLength(5)

        await loginViaUi(page, hrAdmin)
        await navigateInApp(page, '/onboarding')

        // Rendered from the same unstubbed response the assertions above were made against.
        await expect(page.getByTestId('onboarding-page')).toBeVisible()
        await expect(page.getByTestId('onboarding-progress')).toBeVisible()
        await expect(page.getByTestId('activation-status')).toBeVisible()
        // The strongest available tie between DOM and server: the rendered next action must be
        // the destination the API returned, not a client-side guess. The only permitted addition
        // is the bookmarkable return marker the setup-return notice rides on (ONBOARDING-VAL-030).
        const serverHref = state.nextSafeAction.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        await expect(page.getByTestId('onboarding-next-action')).toHaveAttribute(
          'href',
          new RegExp(`^${serverHref}(&from=onboarding)?$`),
        )
      },
    )
  },
)
