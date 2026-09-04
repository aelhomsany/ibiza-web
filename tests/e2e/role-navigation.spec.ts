import { test, expect } from '../support/fixtures'
import { loginViaUi, navigateInApp } from '../support/helpers/auth'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

test.describe('Role-based navigation', { tag: [tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running for role navigation checks',
  )

  test('Employee sees base nav only', async ({ page }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })

    // The Dashboard merged into My Leaves (2026-09-01), leaving two base items:
    // the Team Calendar (now the post-login landing page) and My Leaves.
    await expect(page.getByTestId('nav-calendar')).toBeVisible()
    await expect(page.getByTestId('nav-my-leaves')).toBeVisible()
    await expect(page.getByTestId('nav-my-settings')).toBeVisible()
    await expect(page.getByTestId('nav-dashboard')).toHaveCount(0)
    await expect(page.getByTestId('nav-approvals')).toHaveCount(0)
    await expect(page.getByTestId('nav-settings')).toHaveCount(0)
  })

  test('Manager sees Approvals without Settings', async ({ page }) => {
    await loginViaUi(page, { email: 'alex@company.com', password })

    await expect(page.getByTestId('nav-calendar')).toBeVisible()
    await expect(page.getByTestId('nav-approvals')).toBeVisible()
    await expect(page.getByTestId('nav-settings')).toHaveCount(0)
  })

  test('HR Admin sees Approvals and Settings', async ({ page }) => {
    await loginViaUi(page, { email: 'jordan@company.com', password })

    await expect(page.getByTestId('nav-approvals')).toBeVisible()
    await expect(page.getByTestId('nav-settings')).toBeVisible()
  })

  test('Employee direct URL to settings redirects to the team calendar', async ({ page }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    await navigateInApp(page, '/settings')

    // RoleGuard sends forbidden roles to getHomePath, which is /calendar since
    // the Dashboard merge — not '/', which now only redirects there.
    await expect(page).toHaveURL('/calendar')
    await expect(page.getByTestId('nav-calendar')).toBeVisible()
    await expect(page.getByTestId('team-calendar-page')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Settings' })).toHaveCount(0)
  })

  test('Employee direct URL to approvals redirects to the team calendar', async ({ page }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    await navigateInApp(page, '/approvals')

    await expect(page).toHaveURL('/calendar')
    await expect(page.getByTestId('nav-calendar')).toBeVisible()
    await expect(page.getByTestId('team-calendar-page')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Approvals' })).toHaveCount(0)
  })
})
