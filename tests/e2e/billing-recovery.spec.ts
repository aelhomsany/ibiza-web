import { test, expect } from '../support/fixtures'
import { tags } from '../support/tags'

/**
 * Story 12.4 — sparse billing remediation E2E (BILLING-VAL-120).
 *
 * Only cannot-proceed Restricted workforce mutations with visible remediation.
 * Grace/Portal/lifecycle truth stays API-authoritative.
 *
 * Gate: `E2E_API_AVAILABLE=true` and `E2E_PAID_REGISTRATION=true`.
 */
const paidRegistrationReady =
  process.env.E2E_API_AVAILABLE === 'true' && process.env.E2E_PAID_REGISTRATION === 'true'

test.describe(
  'Billing remediation — Story 12.4',
  { tag: [tags.regression, tags.api, tags.story('12-4')] },
  () => {
    test.skip(
      !paidRegistrationReady,
      'Set E2E_API_AVAILABLE=true and E2E_PAID_REGISTRATION=true when grace/RESTRICTED billing is seeded',
    )

    test(
      '[P0] Given PAST_DUE_GRACE then RESTRICTED, When workforce mutation is attempted, Then the user cannot proceed without visible remediation path',
      async ({ page }) => {
        // Seed assumes Starter org already past the seven-day grace window.
        await page.goto('/settings?category=people')

        await expect(page.getByTestId('billing-restricted-banner').or(page.getByTestId('billing-grace-notice'))).toBeVisible()

        await page.getByTestId('add-member-btn').click()
        await page.getByLabel(/Full name/i).fill('Blocked Hire')
        await page.getByLabel(/Email/i).fill(`blocked+${Date.now()}@example.com`)
        await page.getByLabel(/Department/i).fill('Ops')
        await page.getByLabel(/Workforce Group/i).selectOption({ index: 1 })
        await page.getByRole('button', { name: /Save/i }).click()

        await expect(page.getByTestId('billing-restricted-banner').or(page.getByTestId('app-toast'))).toContainText(
          /payment|restricted|update payment|billing/i,
        )
        await expect(page.getByTestId('cta-update-payment')).toBeVisible()
        await expect(page.getByTestId('cta-reduce-seats').or(page.getByTestId('cta-update-payment'))).toBeVisible()
      },
    )
  },
)
