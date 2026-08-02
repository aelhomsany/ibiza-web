import { test, expect } from '../support/fixtures'
import { tags } from '../support/tags'

const publicBaseUrl = process.env.PUBLIC_BASE_URL ??
  (process.env.E2E_PUBLIC_ARTIFACT === 'true'
    ? 'http://127.0.0.1:4174'
    : process.env.BASE_URL ?? 'http://localhost:5173')

/**
 * Story 12.4 — sparse paid registration E2E (BILLING-VAL-107, 112–113, 124).
 *
 * Provider/business rules stay in API ATDD. This suite only covers cannot-proceed-visible
 * Confirming Payment / paid-but-unprovisioned recovery / first-use handoff.
 *
 * Gate: `E2E_API_AVAILABLE=true` and `E2E_PAID_REGISTRATION=true` (ATDD RED until implemented).
 */
const paidRegistrationReady =
  process.env.E2E_API_AVAILABLE === 'true' && process.env.E2E_PAID_REGISTRATION === 'true'

test.describe(
  'Paid checkout return layout — Story 12.4',
  { tag: [tags.regression, tags.uiOnly, tags.story('12-4')] },
  () => {
    test.skip(
      process.env.E2E_PUBLIC_ARTIFACT !== 'true',
      'Run against the generated public artifact',
    )

    test(
      '[P1] Given authoritative payment is still pending, When EN and AR return pages reflow, Then they show Confirming Payment without false success or overflow',
      async ({ browser }) => {
        for (const locale of ['en', 'ar'] as const) {
          for (const width of [390, 768, 900, 901, 1280, 1440]) {
            const context = await browser.newContext({
              baseURL: publicBaseUrl,
              viewport: { width, height: 900 },
            })
            await context.route('**/api/v1/registrations/reg-layout', (route) =>
              route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                  registrationId: 'reg-layout',
                  status: 'CHECKOUT_PENDING',
                  selectedPlan: 'STARTER',
                  intendedCount: 34,
                  maskedEmail: 'p****@example.com',
                  organizationName: 'Priya Agency',
                  locale,
                  country: 'US',
                  timezone: 'America/New_York',
                  safeReturnPath: '/',
                  resendAvailableInSeconds: 0,
                  workspaceCreated: false,
                  recoveryAction: 'WAIT_FOR_PAYMENT',
                  checkoutSessionId: 'cs_layout',
                }),
              }),
            )
            const page = await context.newPage()
            const path = locale === 'ar' ? '/ar/register/checkout-return' : '/register/checkout-return'
            await page.goto(`${path}?registrationId=reg-layout&outcome=success&plan=STARTER`)

            await expect(page.getByTestId('checkout-return-confirming')).toBeVisible()
            await expect(page.getByRole('heading', { level: 1 })).toContainText(
              locale === 'ar' ? 'تأكيد الدفع' : 'Confirming Payment',
            )
            await expect(page.getByText(/payment successful|workspace ready/i)).toHaveCount(0)
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
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
  'Paid registration — Story 12.4',
  { tag: [tags.regression, tags.api, tags.story('12-4')] },
  () => {
    test.skip(
      !paidRegistrationReady,
      'Set E2E_API_AVAILABLE=true and E2E_PAID_REGISTRATION=true when paid Checkout/provisioning is runnable',
    )

    test(
      '[P0] Given a verified Starter registration, When Checkout and webhook succeed, Then one paid workspace is provisioned and handoff lands first-use without duplicate charge',
      async ({ browser }) => {
        const context = await browser.newContext({ baseURL: publicBaseUrl })
        const page = await context.newPage()
        await page.goto('/register?plan=STARTER&intendedCount=34&locale=en')

        await expect(page.getByTestId('register-plan-summary')).toContainText(/starter/i)
        await expect(page.getByTestId('paid-commitment-review')).toBeVisible()
        await expect(page.getByTestId('paid-commitment-review')).toContainText(/\$3|per active/i)
        await expect(page.getByTestId('paid-commitment-review')).toContainText(/renew|cancel|downgrade/i)

        await page.getByTestId('checkout-start').click()
        // Hosted Checkout is external; return URL lands on Confirming Payment.
        await page.goto('/register/checkout-return?registrationId=e2e-paid-ok&session_id=cs_test')
        await expect(page.getByTestId('checkout-return-confirming')).toBeVisible()
        await expect(page.getByText(/payment successful|workspace ready/i)).toHaveCount(0)

        await expect(page.getByTestId('provisioning-status')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('handoff-status')).toBeVisible()
        await expect(page.getByTestId('first-use-cue')).toBeVisible()
        await context.close()
      },
    )

    test(
      '[P0] Given payment confirmed but provisioning failed, When recovery runs, Then no second Checkout is started and Creation Source stays SELF_SERVICE',
      async ({ browser }) => {
        const context = await browser.newContext({ baseURL: publicBaseUrl })
        const page = await context.newPage()
        await page.goto('/register/recovery?registrationId=e2e-paid-unprovisioned')

        await expect(page.getByTestId('paid-unprovisioned-recovery')).toBeVisible()
        await expect(page.getByTestId('recovery-next-action')).toBeVisible()
        await expect(page.getByTestId('support-reference')).toBeVisible()
        await expect(page.getByTestId('checkout-start')).toHaveCount(0)
        await expect(page.getByText(/pay again|new checkout/i)).toHaveCount(0)
        await context.close()
      },
    )
  },
)
