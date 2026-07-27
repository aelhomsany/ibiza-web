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

        const egypt = filter.locator('option', { hasText: 'Egypt' })
        if ((await egypt.count()) === 0) {
          test.skip(true, 'Seed data lacks a second Workforce Group for filter persistence proof')
        }

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
        await loginViaUi(page, { email: 'sarah@company.com', password })
        await navigateInApp(page, '/calendar')

        await expect(page.getByTestId('team-calendar-page')).toBeVisible()
        await expect(page.getByTestId('team-calendar-loading')).not.toBeVisible()

        const permitted = page.locator('a[data-testid^="calendar-event-"]').first()
        if ((await permitted.count()) === 0) {
          test.skip(
            true,
            'Seed data has no permitted approved absence for click-through in this period',
          )
        }

        await permitted.click()
        await expect(page).toHaveURL(/\/leave-requests\/\d+/)
        await expect(page.getByRole('heading').first()).toBeVisible()
      },
    )
  },
)
