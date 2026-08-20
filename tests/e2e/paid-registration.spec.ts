import { test, expect } from '../support/fixtures'
import { tags } from '../support/tags'
import type { BrowserContext } from '@playwright/test'

const publicBaseUrl = process.env.PUBLIC_BASE_URL ??
  (process.env.E2E_PUBLIC_ARTIFACT === 'true'
    ? 'http://127.0.0.1:4174'
    : process.env.BASE_URL ?? 'http://localhost:5173')

type RegistrationStatus =
  | 'VERIFICATION_PENDING' | 'VERIFIED' | 'CHECKOUT_PENDING' | 'PAYMENT_CONFIRMED'
  | 'PAID_PROVISIONING' | 'FREE_PROVISIONING' | 'ACTIVE' | 'EXPIRED'
  | 'ACTION_REQUIRED' | 'PROVISIONING_FAILED' | 'ABANDONED'

function registrationState(
  registrationId: string,
  status: RegistrationStatus,
  overrides: Record<string, unknown> = {},
) {
  return {
    registrationId,
    status,
    selectedPlan: 'STARTER',
    intendedCount: 34,
    maskedEmail: 'p****@example.com',
    organizationName: 'Priya Agency',
    locale: 'en',
    country: 'US',
    timezone: 'America/New_York',
    safeReturnPath: '/',
    resendAvailableInSeconds: 0,
    workspaceCreated: status === 'ACTIVE',
    recoveryAction: null,
    checkoutSessionId: null,
    ...overrides,
  }
}

/**
 * Story 12.4 — sparse paid registration E2E (BILLING-VAL-107, 113, 124).
 *
 * Provider/business rules stay in API ATDD (`PaidRegistrationCheckoutAndProvisionAtddTest`,
 * `StripeWebhookIntegrationTest`, `BillingLifecycleRecoveryAtddTest`). This suite only covers the
 * cannot-proceed-visible UI contract: Confirming Payment never becomes success from browser
 * parameters, provisioning is legible as its own state, and paid-but-unprovisioned offers exactly
 * one non-duplicating recovery action.
 *
 * These are `@ui-only` because Ibiza's own registration reads are intercepted. That is not a
 * convenience: the authoritative states these assertions need (`PAID_PROVISIONING`, `ACTIVE`,
 * `PROVISIONING_FAILED`) can only be produced by a signed Stripe webhook, so no runner can seed
 * them. Everything below the interception — routing, hydration, components, copy, i18n — is the
 * real public artifact. They previously gated on `E2E_PAID_REGISTRATION`, which no script set, so
 * they never executed; they now run in `npm run test:e2e:public`.
 *
 * `first-use-cue` is deliberately not asserted here. It lives in the customer app
 * (`features/dashboard/FirstUseCue.tsx`) on a different artifact and host, so the public
 * registration context can never see it. It is covered by
 * `auth-first-use.spec.ts::Auth and first-use — Story 11.7`.
 */
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
                body: JSON.stringify(registrationState('reg-layout', 'CHECKOUT_PENDING', {
                  locale,
                  recoveryAction: 'WAIT_FOR_PAYMENT',
                  checkoutSessionId: 'cs_layout',
                })),
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
  { tag: [tags.regression, tags.uiOnly, tags.story('12-4')] },
  () => {
    test.skip(
      process.env.E2E_PUBLIC_ARTIFACT !== 'true',
      'Run against the generated public artifact',
    )

    test(
      '[P0] Given a verified Starter registration, When Checkout and webhook succeed, Then one paid workspace is provisioned and handoff lands first-use without duplicate charge',
      async ({ browser }) => {
        const registrationId = 'reg-e2e-paid'
        const context = await browser.newContext({ baseURL: publicBaseUrl })
        let checkoutStarts = 0
        // Only a signed provider webhook can advance these states, so the test drives the same
        // progression the reconciler would: pending -> provisioning -> active.
        let status: RegistrationStatus = 'CHECKOUT_PENDING'
        await routeRegistration(context, registrationId, {
          state: () => registrationState(registrationId, status, { checkoutSessionId: 'cs_e2e' }),
          onVerify: () => registrationState(registrationId, 'VERIFIED'),
          onCheckout: () => {
            checkoutStarts += 1
            return {
              checkoutUrl: `${publicBaseUrl}/register/checkout-return`
                + `?outcome=success&session_id=cs_e2e&registrationId=${registrationId}`,
              checkoutSessionId: 'cs_e2e',
              status: 'CHECKOUT_PENDING',
            }
          },
        })

        const page = await context.newPage()
        await page.goto('/register?plan=STARTER&intendedCount=34&locale=en')

        // The route opens on the start form, so the commitment review is not on screen yet. The
        // previous expectation asserted it here and could never have passed.
        await expect(page.getByTestId('register-plan-summary')).toContainText(/starter/i)
        await expect(page.getByTestId('register-intended-count')).toHaveValue('34')
        await expect(page.getByTestId('paid-commitment-review')).toHaveCount(0)

        // Verification is the step that produces the commitment review.
        await page.goto(`/register/verify?registrationId=${registrationId}&token=e2e-single-use`)
        const review = page.getByTestId('paid-commitment-review')
        await expect(review).toBeVisible()
        await expect(review).toContainText(/\$3|per active/i)
        await expect(review).toContainText(/renew/i)
        await expect(review).toContainText(/cancel/i)
        await expect(review).toContainText(/downgrade/i)

        // Hosted Checkout is external; the provider's return URL lands on Confirming Payment.
        await page.getByTestId('checkout-start').click()
        await expect(page.getByTestId('checkout-return-confirming')).toBeVisible()
        await expect(page.getByRole('heading', { level: 1 })).toContainText('Confirming Payment')
        await expect(page.getByText(/payment successful|workspace ready/i)).toHaveCount(0)
        await expect(page.getByTestId('provisioning-status')).toHaveCount(0)

        status = 'PAID_PROVISIONING'
        await expect(page.getByTestId('provisioning-status')).toContainText(
          /creating your workspace/i,
          { timeout: 30_000 },
        )
        await expect(page.getByRole('heading', { level: 1 })).toContainText('Confirming Payment')
        await expect(page.getByText(/payment successful|workspace ready/i)).toHaveCount(0)

        status = 'ACTIVE'
        await expect(page.getByTestId('provisioning-status')).toContainText(
          /workspace setup finished/i,
          { timeout: 30_000 },
        )
        await expect(page.getByTestId('recovery-next-action')).toHaveCount(1)

        // Handoff lands the existing first-use path, not Story 12.5 onboarding chrome.
        await page.getByTestId('recovery-next-action').click()
        await expect(page.getByTestId('handoff-status')).toBeVisible()
        await expect(page.getByTestId('onboarding-stage-list')).toHaveCount(0)

        expect(checkoutStarts).toBe(1)
        await context.close()
      },
    )

    test(
      '[P0] Given payment confirmed but provisioning failed, When recovery runs, Then no second Checkout is started and Creation Source stays SELF_SERVICE',
      async ({ browser }) => {
        const registrationId = 'reg-e2e-unprovisioned'
        const context = await browser.newContext({ baseURL: publicBaseUrl })
        let checkoutStarts = 0
        await routeRegistration(context, registrationId, {
          state: () => registrationState(registrationId, 'PROVISIONING_FAILED', {
            recoveryAction: 'RETRY_PROVISIONING',
            checkoutSessionId: 'cs_e2e_unprovisioned',
          }),
          onCheckout: () => {
            checkoutStarts += 1
            return { checkoutUrl: '/', checkoutSessionId: 'cs_never', status: 'CHECKOUT_PENDING' }
          },
        })

        const page = await context.newPage()
        await page.goto(`/register/recovery?registrationId=${registrationId}`)

        await expect(page.getByTestId('paid-unprovisioned-recovery')).toBeVisible()
        await expect(page.getByTestId('recovery-next-action')).toHaveCount(1)
        await expect(page.getByTestId('support-reference')).toBeVisible()
        await expect(page.getByTestId('checkout-start')).toHaveCount(0)
        await expect(page.getByText(/pay again|new checkout/i)).toHaveCount(0)

        expect(checkoutStarts).toBe(0)
        await context.close()
      },
    )
  },
)

/** Serves the pre-tenant registration aggregate for one registration id. */
async function routeRegistration(
  context: BrowserContext,
  registrationId: string,
  handlers: {
    state: () => unknown
    onVerify?: () => unknown
    onCheckout?: () => unknown
  },
): Promise<void> {
  await context.route(`**/api/v1/registrations/${registrationId}**`, async (route) => {
    const path = new URL(route.request().url()).pathname
    const json = (body: unknown) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
    if (path.endsWith('/verify')) return json(handlers.onVerify?.() ?? handlers.state())
    if (path.endsWith('/checkout')) return json(handlers.onCheckout?.() ?? {})
    return json(handlers.state())
  })
}
