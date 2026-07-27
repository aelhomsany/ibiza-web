import { test, expect } from '../support/fixtures'
import { loginViaUi, logoutViaUi } from '../support/helpers/auth'
import { tags } from '../support/tags'

/**
 * Sparse E2E per the Ibiza validation pyramid: browser proof that a clean reset produces curated,
 * trustworthy surfaces (AC 7) — Employee history, HR Settings workforce, and Platform Organizations.
 * Authoritative safety/determinism/isolation coverage lives in the API suite
 * `../ibiza-api/.../config/DemoDataResetIntegrationTest.java`.
 */

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'
const platformAdmin = {
  email: process.env.E2E_PLATFORM_ADMIN_EMAIL ?? 'riley@ibiza.app',
  password: process.env.E2E_PLATFORM_ADMIN_PASSWORD ?? 'PilotDev123!',
}

const CURATED_PRIMARY_ORG = 'Nile Harbor'
const FREE_LIMIT_ORG = 'Saffron Studios'

test.describe(
  'Demo data curated — Story 10.12',
  { tag: [tags.regression, tags.api, tags.story('10-12')] },
  () => {
    test.skip(
      process.env.E2E_API_AVAILABLE !== 'true',
      'Set E2E_API_AVAILABLE=true against a freshly reset curated demo DB',
    )

    test('[P1] Employee sees curated leave history after reset', async ({ page }) => {
      await loginViaUi(page, { email: 'sarah@company.com', password })
      await expect(page.getByText(CURATED_PRIMARY_ORG, { exact: true })).toBeVisible()

      await page.getByTestId('nav-my-leaves').click()
      const history = page.getByTestId('my-leaves-history-table')
      await expect(history).toBeVisible()
      await expect(page.getByText(/pilot-demo:/i)).toHaveCount(0)
      await expect(
        history.getByText('Coverage is needed for the quarterly customer review'),
      ).toBeVisible()
      await expect(history.getByText('Waiting for approval').first()).toBeVisible()
    })

    test('[P1] HR Settings and Platform Organizations show curated data after reset', async ({
      page,
    }) => {
      await loginViaUi(page, { email: 'jordan@company.com', password })
      await page.getByTestId('nav-settings').click()
      await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
      await expect(page.getByRole('tab', { name: 'US', exact: true })).toBeVisible()
      await expect(page.getByRole('tab', { name: 'Egypt', exact: true })).toBeVisible()
      await page.getByTestId('settings-category-people').click()
      await expect(page.getByTestId('team-members-list').getByText('Jordan Lee')).toBeVisible()
      await expect(page.getByTestId('team-members-list').getByText('Alex Johnson')).toBeVisible()
      await expect(page.getByText(/pilot-demo:/i)).toHaveCount(0)

      await logoutViaUi(page)
      await page.getByTestId('sign-in-email').fill(platformAdmin.email)
      await page.getByTestId('sign-in-password').fill(platformAdmin.password)
      await page.getByTestId('sign-in-submit').click()

      await expect(page).toHaveURL(/\/platform\/organizations$/)
      await expect(page.getByRole('heading', { name: 'Organizations', exact: true })).toBeVisible()
      await expect(page.getByText(CURATED_PRIMARY_ORG, { exact: true })).toBeVisible()
      const freeLimitRow = page.getByRole('row').filter({ hasText: FREE_LIMIT_ORG })
      await expect(freeLimitRow.getByText('Free', { exact: true })).toBeVisible()
      await expect(freeLimitRow.getByText('3 / 3', { exact: true })).toBeVisible()
      await expect(freeLimitRow.getByText('AT LIMIT', { exact: true })).toBeVisible()
      await expect(page.getByText(/E2E Nile/i)).toHaveCount(0)
    })
  },
)
