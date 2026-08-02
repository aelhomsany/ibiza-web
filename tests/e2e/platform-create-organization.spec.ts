import { test, expect } from '../support/fixtures'
import { tags } from '../support/tags'

const platformAdminCredentials = {
  email: process.env.E2E_PLATFORM_ADMIN_EMAIL ?? 'riley@ibiza.app',
  password: process.env.E2E_PLATFORM_ADMIN_PASSWORD ?? 'PilotDev123!',
}

test.describe('Platform create organization', { tag: [tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running with platform admin seed',
  )

  test('[P0] Platform Admin creates organization and sees it in list', async ({ page }) => {
    const suffix = Date.now()
    const orgName = `E2E Nile ${suffix}`
    const hrEmail = `hr-${suffix}@e2e.example`

    await page.goto('/app-admin/login')
    await page.getByTestId('platform-sign-in-email').fill(platformAdminCredentials.email)
    await page.getByTestId('platform-sign-in-password').fill(platformAdminCredentials.password)
    await page.getByTestId('platform-sign-in-submit').click()

    await expect(page).toHaveURL(/\/app-admin\/organizations$/)
    await page.getByRole('button', { name: /^Create Organization$/ }).first().click()

    await page.getByLabel('Organization name').fill(orgName)
    await page.getByLabel('Primary contact').fill('Fatima Hassan')
    await page.getByLabel('Initial HR Admin email').fill(hrEmail)
    await page.getByLabel('Subscription plan').selectOption('GROWTH')
    await page
      .getByRole('dialog', { name: 'Create Organization' })
      .getByRole('button', { name: 'Create Organization' })
      .click()

    await expect(page.getByRole('dialog', { name: 'Create Organization' })).toHaveCount(0)
    await expect(page.getByText(orgName)).toBeVisible()
    await expect(page.getByText(`Fatima Hassan · ${hrEmail}`)).toBeVisible()
    await expect(page.getByText('Growth')).toBeVisible()
    await expect(page.getByText('1 / 200')).toBeVisible()
  })
})
