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
 * Story 11.6 — mobile Agenda default, filter persistence, permitted navigation.
 * Existing `team-calendar.spec.ts` remains the live Timeline regression guard.
 * Do not mirror API month/workforceGroupId constraints here.
 */
test.describe(
  'Calendar and mobile agenda — Story 11.6',
  { tag: [tags.regression, tags.api, tags.story('11-6')] },
  () => {
    test.skip(
      process.env.E2E_API_AVAILABLE !== 'true',
      'Set E2E_API_AVAILABLE=true when ibiza-api is running for calendar data',
    )

    test(
      '[P1] Given viewport 390px, When /calendar loads, Then Agenda is default without page overflow',
      async ({ page }) => {
        await loginViaUi(page, { email: 'sarah@company.com', password })
        await page.setViewportSize({ width: 390, height: 844 })
        await navigateInApp(page, '/calendar')

        await expect(page.getByTestId('team-calendar-page')).toBeVisible()
        await expect(page.getByTestId('team-calendar-loading')).not.toBeVisible()
        await expect(page.getByTestId('calendar-agenda')).toBeVisible()
        await expect(page.getByTestId('calendar-week-strip')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Agenda' })).toHaveAttribute(
          'aria-pressed',
          'true',
        )
        await expect(page.getByTestId('calendar-timeline')).toHaveCount(0)
        await expectPageDoesNotOverflow(page)
      },
    )

    test(
      '[P0] Given Workforce Group filter selected, When switching Timeline and Agenda, Then filter selection persists',
      async ({ page }) => {
        await loginViaUi(page, { email: 'sarah@company.com', password })
        await page.setViewportSize({ width: 1280, height: 800 })
        await navigateInApp(page, '/calendar')

        await expect(page.getByTestId('team-calendar-page')).toBeVisible()
        const filter = page.getByRole('combobox', { name: 'Workforce Group' })
        await expect(filter).toBeVisible()

        // The curated demo seed always provisions two Workforce Groups (US + Egypt) —
        // DemoScenarioSeeder.EGYPT_GROUP, asserted by DemoDataResetIntegrationTest
        // #resetSeedsCurrentYearHolidaysNotificationsBalancesAndAuditHistory. A missing
        // option is a seed defect, so fail here instead of reporting a green skip.
        await expect(filter.locator('option', { hasText: 'Egypt' })).toHaveCount(1)

        await filter.selectOption({ label: 'Egypt' })
        await expect(filter).toHaveValue(/.+/)

        await page.getByRole('button', { name: 'Agenda' }).click()
        await expect(page.getByTestId('calendar-agenda')).toBeVisible()
        await expect(filter).toHaveDisplayValue(/Egypt/i)

        await page.getByRole('button', { name: 'Timeline' }).click()
        await expect(page.getByTestId('calendar-timeline')).toBeVisible()
        await expect(filter).toHaveDisplayValue(/Egypt/i)
      },
    )

    test(
      '[P1] Given a permitted absence chip, When activated, Then request context navigation succeeds',
      async ({ page }) => {
        // HR Admin, not an Employee: LeaveRequestContextService#canViewRequestContext
        // grants HR_ADMIN request context for every absence in the org, so the chip is
        // always a link. The curated seed anchors Mike's approved WFH to
        // nearestWorkingDay(today) (LeaveRequestProvisioner KEY_MIKE_WFH_TODAY), which
        // guarantees at least one permitted absence inside the default period.
        await loginViaUi(page, { email: 'jordan@company.com', password })
        await navigateInApp(page, '/calendar')

        await expect(page.getByTestId('team-calendar-page')).toBeVisible()
        await expect(page.getByTestId('team-calendar-loading')).not.toBeVisible()

        const permitted = page.locator('a[data-testid^="calendar-event-"]').first()
        await expect(permitted).toBeVisible()

        await permitted.click()
        await expect(page).toHaveURL(/\/leave-requests\/\d+/)
        await expect(page.getByRole('heading').first()).toBeVisible()
      },
    )
  },
)
