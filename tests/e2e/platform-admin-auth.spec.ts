import { test, expect } from '../support/fixtures'
import { tags } from '../support/tags'

const platformAdminCredentials = {
  email: process.env.E2E_PLATFORM_ADMIN_EMAIL ?? 'riley@ibiza.app',
  password: process.env.E2E_PLATFORM_ADMIN_PASSWORD ?? 'PilotDev123!',
}

test.describe('Platform Admin authentication', { tag: [tags.smoke, tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running with platform admin seed (riley@ibiza.app)',
  )

  test('[P0] real Platform Admin login lands in admin shell without org navigation', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByTestId('sign-in-email').fill(platformAdminCredentials.email)
    await page.getByTestId('sign-in-password').fill(platformAdminCredentials.password)
    await page.getByTestId('sign-in-submit').click()

    await expect(page).toHaveURL(/\/platform\/organizations$/)
    await expect(page.getByTestId('admin-shell')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Organizations', exact: true })).toBeVisible()
    await expect(page.getByTestId('sidebar').getByText('Ibiza Admin')).toBeVisible()
    await expect(page.getByText('Platform Console')).toBeVisible()
    await expect(page.getByTestId('nav-organizations')).toBeVisible()

    await expect(page.getByTestId('nav-dashboard')).toHaveCount(0)
    await expect(page.getByTestId('nav-my-leaves')).toHaveCount(0)
    await expect(page.getByTestId('nav-calendar')).toHaveCount(0)
    await expect(page.getByTestId('nav-approvals')).toHaveCount(0)
    await expect(page.getByTestId('nav-settings')).toHaveCount(0)
    await expect(page.getByTestId('notification-bell')).toHaveCount(0)
  })
})
