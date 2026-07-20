import { test, expect } from '../support/fixtures'
import { loginViaUi, navigateInApp } from '../support/helpers/auth'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

test.describe('Team Calendar — Story 4.2 / 7.11', { tag: [tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running for calendar data',
  )

  test('[P1] Employee sees calendar week nav and timeline at /calendar', async ({ page }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    await navigateInApp(page, '/calendar')

    await expect(page.getByTestId('team-calendar-page')).toBeVisible()
    await expect(page.getByTestId('calendar-prev-week')).toBeVisible()
    await expect(page.getByTestId('calendar-next-week')).toBeVisible()

    await expect(page.getByTestId('team-calendar-loading')).not.toBeVisible()
    await expect(page.getByTestId('team-calendar-error')).not.toBeVisible()
    await expect(page.getByTestId('calendar-timeline')).toBeVisible()

    const label = page.getByTestId('calendar-period-label')
    const before = await label.textContent()

    await page.getByTestId('calendar-next-week').click()

    await expect(label).not.toHaveText(before ?? '')
    await expect(page.getByTestId('calendar-timeline')).toBeVisible()
  })
})
