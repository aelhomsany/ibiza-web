import { test, expect } from '../support/fixtures'
import { tags } from '../support/tags'

const platformAdminCredentials = {
  email: process.env.E2E_PLATFORM_ADMIN_EMAIL ?? 'riley@ibiza.app',
  password: process.env.E2E_PLATFORM_ADMIN_PASSWORD ?? 'PilotDev123!',
}

/**
 * PLAT-VAL-008 — executable proof that a real Platform Admin credential reaches
 * the admin shell and that the admin realm carries none of the org-shell
 * navigation (UX-DR28: no employee leave tables, Approvals, or Calendar).
 *
 * Every other platform spec asserts a feature *inside* the shell and assumes the
 * login worked. This one owns the login itself, so the assumption has a test.
 */
test.describe('Platform admin authentication', { tag: [tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running with platform admin seed',
  )

  test('[P0] real Platform Admin login lands in admin shell without org navigation', async ({
    page,
  }) => {
    await page.goto('/app-admin/login')
    await expect(page.getByTestId('platform-login-page')).toBeVisible()

    await page.getByTestId('platform-sign-in-email').fill(platformAdminCredentials.email)
    await page.getByTestId('platform-sign-in-password').fill(platformAdminCredentials.password)
    await page.getByTestId('platform-sign-in-submit').click()

    // Lands in the admin realm, not on a generic authenticated route.
    await expect(page).toHaveURL(/\/app-admin\/organizations$/)
    await expect(page.getByTestId('admin-shell')).toBeVisible()
    await expect(page.getByTestId('nav-organizations')).toBeVisible()

    // UX-DR28 — the admin shell must never expose workforce leave surfaces.
    await expect(page.getByTestId('nav-dashboard')).toHaveCount(0)
    await expect(page.getByTestId('nav-my-leaves')).toHaveCount(0)
    await expect(page.getByTestId('nav-calendar')).toHaveCount(0)
    await expect(page.getByTestId('nav-approvals')).toHaveCount(0)
    await expect(page.getByTestId('nav-settings')).toHaveCount(0)
  })
})
