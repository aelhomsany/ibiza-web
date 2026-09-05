import { test, expect } from '../support/fixtures'
import { tags } from '../support/tags'

const platformAdminCredentials = {
  email: process.env.E2E_PLATFORM_ADMIN_EMAIL ?? 'riley@leaveo.example',
  password: process.env.E2E_PLATFORM_ADMIN_PASSWORD ?? 'PilotDev123!',
}

test.describe('Platform edit subscription', { tag: [tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running with platform admin seed',
  )

  test('[P0] Platform Admin edits Nile Harbor subscription and row plan badge updates', async ({ page }) => {
    await page.goto('/app-admin/login')
    await page.getByTestId('platform-sign-in-email').fill(platformAdminCredentials.email)
    await page.getByTestId('platform-sign-in-password').fill(platformAdminCredentials.password)
    await page.getByTestId('platform-sign-in-submit').click()

    await expect(page).toHaveURL(/\/app-admin\/organizations/)
    await expect(page.getByText('Nile Harbor')).toBeVisible()

    // Target the Nile Harbor row by name. `.first()` was the FIRST row of the table, which is
    // only Nile Harbor when nothing else exists — platform-create-organization.spec.ts adds
    // "Meridian Labs", which sorts ahead of it, so this opened the wrong Organization's modal.
    // The closing assertions are scoped to the same row for the same reason: `getByText('Growth')`
    // page-wide would have passed on any other Organization's Growth badge.
    const nileHarborRow = page.getByRole('row').filter({ hasText: 'Nile Harbor' })
    await nileHarborRow.getByRole('button', { name: /Edit Subscription/i }).click()
    await expect(page.getByTestId('edit-subscription-modal')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /Edit Subscription — \u2068?Nile Harbor\u2069?/i }),
    ).toBeVisible()

    await page.getByTestId('edit-subscription-plan').selectOption('GROWTH')
    await page.getByTestId('edit-subscription-effective-date').fill('2026-06-27')
    await page.getByTestId('edit-subscription-submit').click()

    await expect(page.getByTestId('edit-subscription-modal')).toHaveCount(0)
    await expect(nileHarborRow.getByText('Growth', { exact: true })).toBeVisible()
    await expect(nileHarborRow.getByText(/\d+ \/ 200/)).toBeVisible()
  })
})
