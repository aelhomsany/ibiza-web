import { test, expect } from '../support/fixtures'
import { loginViaUi, navigateInApp } from '../support/helpers/auth'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

test.describe('HR Settings page', { tag: [tags.smoke, tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when leaveo-api is running for settings data',
  )

  test('[P1] HR Admin sees workforce group tabs and holidays on Settings', async ({ page }) => {
    await loginViaUi(page, { email: 'jordan@company.com', password })
    await navigateInApp(page, '/settings')

    // exact: Story 11.5's SettingsCategoryNav adds an sr-only "Settings categories" h2,
    // so a substring match resolves to two headings and trips strict mode.
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
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
    await navigateInApp(page, '/settings?category=leave-policies')

    await expect(page.getByTestId('leave-types-card')).toBeVisible()
    // The card's "Default entitlements" support note repeats every type name and entitlement,
    // so the assertions are scoped to the list itself.
    const list = page.getByTestId('leave-types-list')
    await expect(list.getByText('Annual Leave')).toBeVisible()
    await expect(list.getByText('20 days default')).toBeVisible()
  })
})
