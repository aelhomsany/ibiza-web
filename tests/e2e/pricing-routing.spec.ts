import { test, expect } from '../support/fixtures'
import { tags } from '../support/tags'

const publicBaseUrl = process.env.PUBLIC_BASE_URL ??
  (process.env.E2E_PUBLIC_ARTIFACT === 'true'
    ? 'http://127.0.0.1:4174'
    : process.env.BASE_URL ?? 'http://localhost:5173')

function catalog(count: number) {
  const recommendedPlan = count <= 5 ? 'FREE' : count <= 50 ? 'STARTER' : count <= 200 ? 'GROWTH' : 'CONTACT_SALES'
  const plan = (
    code: string,
    minimumActiveUsers: number,
    maximumActiveUsers: number | null,
    userBand: string,
    monthlyPricePerActiveUserCents: number | null,
    priceBasis: string,
    cardRequired: boolean,
    ctaLabel: string,
  ) => ({
    code,
    name: code === 'CONTACT_SALES' ? 'Contact Sales' : code[0] + code.slice(1).toLowerCase(),
    minimumActiveUsers,
    maximumActiveUsers,
    userBand,
    monthlyPricePerActiveUserCents,
    currency: monthlyPricePerActiveUserCents === null ? null : 'USD',
    priceBasis,
    cardRequired,
    availability: code === 'CONTACT_SALES' ? 'ASSISTED' : 'SELF_SERVICE_WHEN_ENABLED',
    ctaLabel,
    materialTerms: ['Renews monthly until cancelled', 'Cancel before renewal'],
    capabilities: [
      { code: 'WORKING_DAY_TRANSPARENCY', label: 'Working-day transparency', availability: 'AVAILABLE', presentation: 'INCLUDED', checkoutEligible: code !== 'CONTACT_SALES' },
      { code: 'ADVANCED_REPORTING', label: 'Advanced reporting', availability: 'COMING_SOON', presentation: 'PLANNED', checkoutEligible: false },
    ],
  })
  return {
    intendedCount: count,
    locale: 'en',
    recommendedPlan,
    registrationEnabled: false,
    plans: [
      plan('FREE', 1, 5, '1-5 active Users', 0, '$0 forever', false, 'Start Free'),
      plan('STARTER', 6, 50, '6-50 active Users', 300, '$3 per active User / month', true, 'Choose Starter'),
      plan('GROWTH', 51, 200, '51-200 active Users', 600, '$6 per active User / month', true, 'Choose Growth'),
      plan('CONTACT_SALES', 201, null, 'More than 200 active Users or complex needs', null, 'Assisted plan', false, 'Contact Sales'),
    ],
  }
}

/**
 * Story 12.2 — sparse Pricing E2E (SALES-VAL-005/007/012).
 * Band truth and capability availability stay API-authoritative; this suite only
 * proves visible routing, preserved plan/count/locale in fallback, keyboard reach,
 * and no workspace-created belief.
 */
test.describe(
  'Pricing plan routing — Story 12.2',
  { tag: [tags.regression, tags.uiOnly, tags.story('12-2')] },
  () => {
    test(
      '[P0] Given intended-user counts at band boundaries, When Pricing renders recommendations, Then Free/Starter/Growth/Contact Sales routes are exact',
      async ({ browser, browserName }) => {
        const context = await browser.newContext({ baseURL: publicBaseUrl })
        await context.route('**/api/v1/public/plans**', async (route) => {
          const count = Number(new URL(route.request().url()).searchParams.get('intendedCount'))
          await route.fulfill({ json: catalog(count) })
        })
        const pricingPage = await context.newPage()
        await pricingPage.goto('/pricing')

        const cases: Array<{ count: string; plan: string; cta: string }> = [
          { count: '5', plan: 'plan-card-free', cta: 'cta-start-free' },
          { count: '6', plan: 'plan-card-starter', cta: 'cta-choose-starter' },
          { count: '50', plan: 'plan-card-starter', cta: 'cta-choose-starter' },
          { count: '51', plan: 'plan-card-growth', cta: 'cta-choose-growth' },
          { count: '200', plan: 'plan-card-growth', cta: 'cta-choose-growth' },
          { count: '201', plan: 'plan-card-contact-sales', cta: 'cta-contact-sales' },
        ]

        for (const { count, plan, cta } of cases) {
          await pricingPage.getByTestId('pricing-intended-count').fill(count)
          await expect(pricingPage.getByTestId(plan)).toHaveAttribute('data-recommended', 'true')
          await expect(pricingPage.getByTestId(cta)).toBeVisible()
          await expect(pricingPage.getByText(/workspace (was )?created/i)).toHaveCount(0)
        }

        // Registration-disabled fallback must preserve plan, count, and locale.
        await pricingPage.getByTestId('pricing-intended-count').fill('50')
        const fallback = pricingPage.getByTestId('pricing-availability-fallback')
        await expect(fallback).toBeVisible()
        await expect(fallback).toHaveAttribute('data-plan', /STARTER/i)
        await expect(fallback).toHaveAttribute('data-intended-count', '50')
        await expect(fallback).toHaveAttribute('data-locale', 'en')
        await expect(pricingPage.locator('body')).not.toContainText('INTERNAL')

        // Sparse keyboard proof: Tab can reach the recommended CTA; Enter activates.
        await pricingPage.getByTestId('pricing-intended-count').focus()
        let reachedCta = false
        for (let i = 0; i < 24; i++) {
          // macOS WebKit follows Safari's Option+Tab convention for links/buttons.
          await pricingPage.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab')
          const focused = await pricingPage.evaluate(() => document.activeElement?.getAttribute('data-testid'))
          if (focused === 'cta-choose-starter') {
            reachedCta = true
            break
          }
        }
        expect(reachedCta).toBe(true)
        await pricingPage.keyboard.press('Enter')
        await expect(pricingPage.getByTestId('pricing-availability-fallback')).toBeVisible()

        for (const width of [390, 768, 900, 901, 1280, 1440]) {
          await pricingPage.setViewportSize({ width, height: 900 })
          const layout = await pricingPage.evaluate(() => ({
            viewport: window.innerWidth,
            documentWidth: document.documentElement.scrollWidth,
          }))
          expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewport)
        }

        await pricingPage.emulateMedia({ reducedMotion: 'reduce' })
        const transitionDuration = await pricingPage.getByTestId('cta-choose-starter')
          .evaluate((element) => getComputedStyle(element).transitionDuration)
        expect(parseFloat(transitionDuration || '0')).toBeLessThanOrEqual(0.01)

        await pricingPage.goto('/ar/pricing')
        await expect(pricingPage.locator('html')).toHaveAttribute('lang', 'ar')
        await expect(pricingPage.locator('html')).toHaveAttribute('dir', 'rtl')
        await expect(pricingPage.getByTestId('plan-card-free')).toBeVisible()
        const arabicLayout = await pricingPage.evaluate(() => ({
          viewport: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
        }))
        expect(arabicLayout.documentWidth).toBeLessThanOrEqual(arabicLayout.viewport)

        await context.close()
      },
    )
  },
)
