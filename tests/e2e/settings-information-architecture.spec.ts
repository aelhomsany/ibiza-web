import { test, expect } from '../support/fixtures'
import { loginViaUi, navigateInApp } from '../support/helpers/auth'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

async function expectPageDoesNotOverflow(page: import('@playwright/test').Page) {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    )
    .toBe(true)
}

/**
 * Story 11.5 — Settings IA deep-link / mobile category / unsaved cannot-proceed.
 * Epic 2 smoke (`settings-hr.spec.ts`) remains the live composition guard.
 * Do not mirror API field constraints here — SPA navigation/guards only.
 */
test.describe(
  'Settings information architecture — Story 11.5',
  { tag: [tags.regression, tags.api, tags.story('11-5')] },
  () => {
    test.skip(
      process.env.E2E_API_AVAILABLE !== 'true',
      'Set E2E_API_AVAILABLE=true when ibiza-api is running for Settings seed data',
    )

    test(
      '[P1] Given category=people in URL, When Settings loads, Then People panel is shown',
      async ({ page }) => {
        await loginViaUi(page, { email: 'jordan@company.com', password })
        await navigateInApp(page, '/settings?category=people')

        await expect(page.getByTestId('settings-page')).toBeVisible()
        await expect(page.getByTestId('settings-category-nav')).toBeVisible()
        await expect(page.getByTestId('settings-category-people')).toHaveAttribute(
          'aria-selected',
          'true',
        )
        await expect(page.getByTestId('settings-panel-people')).toBeVisible()
        await expect(page.getByTestId('team-members-card')).toBeVisible()
        await expect(page.getByTestId('settings-panel-working-calendars')).toHaveCount(0)
      },
    )

    test(
      '[P0] Given Settings at 390px, When the category strip renders, Then categories are reachable without page overflow',
      async ({ page }) => {
        await loginViaUi(page, { email: 'jordan@company.com', password })
        await page.setViewportSize({ width: 390, height: 844 })
        await navigateInApp(page, '/settings')

        await expect(page.getByTestId('settings-page')).toBeVisible()
        const nav = page.getByTestId('settings-category-nav')
        await expect(nav).toBeVisible()

        const people = page.getByTestId('settings-category-people')
        await people.scrollIntoViewIfNeeded()
        await expect(people).toBeVisible()
        await people.click()

        await expect(page.getByTestId('settings-panel-people')).toBeVisible()
        await expectPageDoesNotOverflow(page)
      },
    )

    test(
      '[P1] Given a dirty Working calendars draft, When navigating away from Settings, Then unsaved discard Modal blocks leave',
      async ({ page }) => {
        await loginViaUi(page, { email: 'jordan@company.com', password })
        await navigateInApp(page, '/settings?category=working-calendars')

        await expect(page.getByTestId('settings-panel-working-calendars')).toBeVisible()
        // Preferred Coastal draft path: toggle weekend into dirty state without immediate save.
        await page.getByRole('checkbox', { name: /Fri weekend day/i }).first().click()

        await navigateInApp(page, '/my-leaves')

        const modal = page.getByTestId('settings-unsaved-discard-modal')
        await expect(modal).toBeVisible()
        await expect(page).toHaveURL(/\/settings/)

        await page.getByTestId('settings-unsaved-continue-btn').click()
        await expect(modal).toHaveCount(0)
        await expect(page).toHaveURL(/\/settings/)
      },
    )
  },
)
