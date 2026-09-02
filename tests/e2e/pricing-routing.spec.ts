import { test, expect } from '../support/fixtures'
import { tags } from '../support/tags'

const publicBaseUrl = process.env.PUBLIC_BASE_URL ??
  (process.env.E2E_PUBLIC_ARTIFACT === 'true'
    ? 'http://127.0.0.1:4174'
    : process.env.BASE_URL ?? 'http://localhost:5173')

function catalog(count: number) {
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
    recommendedPlan: 'FREE',
    registrationEnabled: false,
    plans: [
      plan('FREE', 1, 5, '1-5 active Users', 0, '$0 forever', false, 'Start Free'),
      plan('GROWTH', 1, 200, '1-200 active Users', 100, '$1 per active User / month', true, 'Choose Growth'),
      plan('CONTACT_SALES', 201, null, 'More than 200 active Users or complex needs', null, 'Assisted plan', false, 'Contact Sales'),
    ],
  }
}

/**
 * Story 12.2 — sparse Pricing E2E (SALES-VAL-005/007/012).
 * Band truth and capability availability stay API-authoritative; this suite only
 * proves the visible comparison, CTAs that share one baseline, preserved
 * plan/count/locale in fallback, keyboard reach, and no workspace-created belief.
 */
test.describe(
  'Pricing plan routing — Story 12.2',
  { tag: [tags.regression, tags.uiOnly, tags.story('12-2')] },
  () => {
    // Pricing is a public-site route, so it is absent from the SPA artifact preview that CI's
    // ui-only job serves. Same guard as public-entry-boundaries.spec.ts.
    test.skip(
      process.env.E2E_PUBLIC_ARTIFACT !== 'true',
      'The public Pricing page is served only by the public artifact; run npm run test:e2e:public',
    )

    test(
      '[P0] Given the published plan comparison, When Pricing renders, Then every plan routes exactly and its CTA shares one baseline',
      async ({ browser, browserName }) => {
        const context = await browser.newContext({ baseURL: publicBaseUrl })
        await context.route('**/api/v1/public/plans**', async (route) => {
          const count = Number(new URL(route.request().url()).searchParams.get('intendedCount'))
          await route.fulfill({ json: catalog(count) })
        })
        const pricingPage = await context.newPage()
        // The count survives as a handoff value on the entry link; the page itself asks nothing.
        await pricingPage.goto('/pricing?intendedCount=50')
        await pricingPage.setViewportSize({ width: 1280, height: 900 })

        const ctaIds = ['cta-start-free', 'cta-choose-growth', 'cta-contact-sales']
        for (const [index, plan] of ['plan-card-free', 'plan-card-growth', 'plan-card-contact-sales'].entries()) {
          await expect(pricingPage.getByTestId(plan)).toBeVisible()
          await expect(pricingPage.getByTestId(ctaIds[index])).toBeVisible()
        }
        await expect(pricingPage.getByText(/workspace (was )?created/i)).toHaveCount(0)
        await expect(pricingPage.locator('body')).not.toContainText('INTERNAL')

        // Nothing is asked of the visitor: no intended-count field, no complex-needs question.
        await expect(pricingPage.locator('input[type="number"]')).toHaveCount(0)
        await expect(pricingPage.locator('.pricing-experience input[type="checkbox"]')).toHaveCount(0)

        // Uneven capability lists must not stagger the CTAs: each sits on its card's bottom edge.
        const ctaBottoms = await Promise.all(
          ctaIds.map(async (id) => {
            const box = await pricingPage.getByTestId(id).boundingBox()
            if (!box) throw new Error(`${id} has no box`)
            return box.y + box.height
          }),
        )
        for (const bottom of ctaBottoms) {
          expect(Math.abs(bottom - ctaBottoms[0])).toBeLessThanOrEqual(1)
        }

        // Registration-disabled fallback must preserve plan, count, and locale.
        await pricingPage.getByTestId('cta-choose-growth').click()
        const fallback = pricingPage.getByTestId('pricing-availability-fallback')
        await expect(fallback).toBeVisible()
        await expect(fallback).toHaveAttribute('data-plan', /GROWTH/i)
        await expect(fallback).toHaveAttribute('data-intended-count', '50')
        await expect(fallback).toHaveAttribute('data-locale', 'en')

        // Sparse keyboard proof: Tab can reach a plan CTA; Enter activates.
        await pricingPage.reload()
        await pricingPage.getByTestId('plan-card-growth').waitFor()
        let reachedCta = false
        for (let i = 0; i < 24; i++) {
          // macOS WebKit follows Safari's Option+Tab convention for links/buttons.
          await pricingPage.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab')
          const focused = await pricingPage.evaluate(() => document.activeElement?.getAttribute('data-testid'))
          if (focused === 'cta-choose-growth') {
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
        const transitionDuration = await pricingPage.getByTestId('cta-choose-growth')
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
