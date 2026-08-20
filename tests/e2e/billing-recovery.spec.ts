import { test, expect } from '../support/fixtures'
import { tags } from '../support/tags'
import type { Page, Route } from '@playwright/test'

/**
 * Story 12.4 — sparse billing remediation E2E (BILLING-VAL-120).
 *
 * Only the cannot-proceed contract: a RESTRICTED Organization cannot grow its workforce, and the
 * remediation paths AC4 guarantees (payment and seat reduction) stay visible and reachable.
 * Grace/Portal/lifecycle truth stays API-authoritative in `BillingLifecycleRecoveryAtddTest` and
 * `StripeWebhookIntegrationTest`; the seven-day timer and the RESTRICTED transition are not
 * re-asserted here.
 *
 * `@ui-only`: RESTRICTED is reachable only through a signed provider webhook — the Platform Admin
 * subscription API accepts `MANUAL_*` states exclusively (ADR-001), so no runner can seed it. The
 * spec therefore serves the authoritative responses and exercises the real org shell, the real
 * Settings people surface, and the real `billing-restricted` problem+json the API returns from
 * `TeamMemberService.enforcePlanUserLimit`. It previously gated on `E2E_PAID_REGISTRATION`, which
 * no script ever set, so it never executed.
 */
const RESTRICTED_SUBSCRIPTION = {
  plan: 'STARTER',
  billingStatus: 'RESTRICTED',
  activeSeats: 14,
  pendingInvitations: 0,
  billableQuantity: 14,
  seatLimit: 50,
  pendingPlan: null,
  currentPeriodEnd: '2026-09-30T00:00:00Z',
  graceEndsAt: '2026-08-12T00:00:00Z',
  cancelAtPeriodEnd: false,
}

/** Exactly what `TeamMemberService` returns once billing is RESTRICTED. */
const BILLING_RESTRICTED_PROBLEM = {
  type: 'https://ibiza.app/errors/conflict',
  title: 'Conflict',
  status: 409,
  detail: 'Workforce changes are restricted until billing is remediated',
  instance: '/api/v1/team-members/invitations',
  code: 'billing-restricted',
}

test.describe(
  'Billing remediation — Story 12.4',
  { tag: [tags.regression, tags.uiOnly, tags.story('12-4')] },
  () => {
    test(
      '[P0] Given PAST_DUE_GRACE then RESTRICTED, When workforce mutation is attempted, Then the user cannot proceed without visible remediation path',
      async ({ page }) => {
        let createAttempts = 0
        await routeCustomerApi(page, {
          onCreateMember: () => {
            createAttempts += 1
            return BILLING_RESTRICTED_PROBLEM
          },
        })

        await page.goto('/settings?category=people')

        const banner = page.getByTestId('billing-restricted-banner')
        await expect(banner).toBeVisible()
        await expect(banner).toHaveAttribute('role', 'alert')

        await page.getByTestId('add-member-btn').click()
        await page.getByLabel(/Full name/i).fill('Blocked Hire')
        await page.getByLabel(/Email/i).fill(`blocked+${Date.now()}@example.com`)
        await page.getByLabel(/Department/i).fill('Ops')
        await page.getByLabel(/Workforce Group/i).selectOption({ index: 1 })
        await page.getByRole('button', { name: /Save/i }).click()

        // Blocked, with the reason stated in words rather than by colour alone.
        await expect(page.getByTestId('app-toast')).toContainText(
          /payment|restricted|update payment|billing/i,
        )
        await expect(page.getByText(/Add Team Member/i)).toBeVisible()
        expect(createAttempts).toBe(1)

        // AC4: payment recovery and seat reduction both stay reachable while restricted.
        await expect(page.getByTestId('cta-update-payment')).toBeVisible()
        const reduceSeats = page.getByTestId('cta-reduce-seats')
        await expect(reduceSeats).toBeVisible()
        await expect(reduceSeats).toHaveAttribute('href', '/settings?category=people')
      },
    )
  },
)

/**
 * Serves the customer app's bootstrap and Settings reads. Unknown reads resolve to an empty
 * collection so an unrelated new query cannot silently hang this suite.
 */
async function routeCustomerApi(
  page: Page,
  handlers: { onCreateMember: () => unknown },
): Promise<void> {
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: status >= 400 ? 'application/problem+json' : 'application/json',
      body: JSON.stringify(body),
    })

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()

    if (path.endsWith('/auth/refresh')) {
      return json(route, {
        accessToken: 'e2e-restricted-access-token',
        refreshToken: 'e2e-restricted-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 900,
      })
    }
    if (path.endsWith('/auth/me')) {
      return json(route, {
        id: 1,
        email: 'priya.hr@example.com',
        fullName: 'Priya Raman',
        role: 'HR_ADMIN',
        organizationId: 4104,
        organizationName: 'Priya Agency',
        timezone: 'America/New_York',
        preferredLanguage: 'en',
      })
    }
    if (path.endsWith('/billing/subscription')) return json(route, RESTRICTED_SUBSCRIPTION)
    // Adding a member creates an invitation; that is the path `enforcePlanUserLimit` guards.
    if (path.endsWith('/team-members/invitations') && method === 'POST') {
      return json(route, handlers.onCreateMember(), 409)
    }
    if (path.endsWith('/team-members')) {
      return json(route, [
        {
          id: 1,
          fullName: 'Priya Raman',
          email: 'priya.hr@example.com',
          department: 'People',
          role: 'HR_ADMIN',
          status: 'ACTIVE',
          workforceGroupId: 1,
          workforceGroupName: 'US Team',
          managerId: null,
          managerName: null,
        },
      ])
    }
    if (path.endsWith('/workforce-groups')) {
      return json(route, [
        { id: 1, name: 'US Team', country: 'US', timezone: 'America/New_York', memberCount: 1 },
      ])
    }
    if (path.endsWith('/pending-count') || path.endsWith('/unread-count')) {
      return json(route, { count: 0 })
    }
    if (path.endsWith('/approvals/capability')) return json(route, { canApprove: false })
    if (method !== 'GET') return json(route, {}, 204)
    return json(route, [])
  })
}
