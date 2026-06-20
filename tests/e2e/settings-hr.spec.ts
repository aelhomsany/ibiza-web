import { test, expect } from '../support/fixtures'
import { loginViaUi, navigateInApp } from '../support/helpers/auth'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

test.describe('HR Settings page', () => {
  test.skip(
    !process.env.E2E_API_AVAILABLE,
    'Set E2E_API_AVAILABLE=true when ibiza-api is running for settings data',
  )

  test('[P1] HR Admin sees workforce group tabs and holidays on Settings', async ({ page }) => {
    await loginViaUi(page, { email: 'jordan@company.com', password })
    await navigateInApp(page, '/settings')

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.getByTestId('workforce-groups-weekends-card')).toBeVisible()
    await expect(page.getByRole('tab', { name: 'US' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Egypt' })).toBeVisible()
    await expect(page.getByTestId('weekend-chips')).toBeVisible()
    await expect(page.getByTestId('public-holidays-section')).toBeVisible()
  })

  test('[P1] Switching workforce group tab updates the active weekend label', async ({ page }) => {
    await loginViaUi(page, { email: 'jordan@company.com', password })
    await navigateInApp(page, '/settings')

    await expect(page.getByText('US', { exact: true }).first()).toBeVisible()
    await page.getByRole('tab', { name: 'Egypt' }).click()
    await expect(page.getByText('Egypt', { exact: true }).first()).toBeVisible()
  })

  test('[P2] Leave Types card shows Annual Leave row', async ({ page }) => {
    await loginViaUi(page, { email: 'jordan@company.com', password })
    await navigateInApp(page, '/settings')

    await expect(page.getByTestId('leave-types-card')).toBeVisible()
    await expect(page.getByText('Annual Leave')).toBeVisible()
    await expect(page.getByText('20 days default')).toBeVisible()
  })
})
