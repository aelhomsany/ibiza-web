import { test, expect } from '../support/fixtures'

const platformAdminCredentials = {
  email: process.env.E2E_PLATFORM_ADMIN_EMAIL ?? 'riley@ibiza.app',
  password: process.env.E2E_PLATFORM_ADMIN_PASSWORD ?? 'PilotDev123!',
}

test.describe('Platform edit subscription', () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running with platform admin seed',
  )

  test('[P0] Platform Admin edits Acme subscription and row plan badge updates', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('sign-in-email').fill(platformAdminCredentials.email)
    await page.getByTestId('sign-in-password').fill(platformAdminCredentials.password)
    await page.getByTestId('sign-in-submit').click()

    await expect(page).toHaveURL(/\/platform\/organizations/)
    await expect(page.getByText('Acme Corp')).toBeVisible()

    await page.getByRole('button', { name: 'Edit Subscription' }).first().click()
    await expect(page.getByTestId('edit-subscription-modal')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /Edit Subscription — Acme Corp/i }),
    ).toBeVisible()

    await page.getByTestId('edit-subscription-plan').selectOption('STARTER')
    await page.getByTestId('edit-subscription-effective-date').fill('2026-06-27')
    await page.getByTestId('edit-subscription-submit').click()

    await expect(page.getByTestId('edit-subscription-modal')).toHaveCount(0)
    await expect(page.getByText('Starter')).toBeVisible()
    await expect(page.getByText(/\d+ \/ 50/)).toBeVisible()
  })
})
