import { test, expect } from '../support/fixtures'
import { loginViaUi, navigateInApp } from '../support/helpers/auth'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

test.describe('Role-based navigation', () => {
  test('Employee sees base nav only', async ({ page }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })

    await expect(page.getByTestId('nav-dashboard')).toBeVisible()
    await expect(page.getByTestId('nav-my-leaves')).toBeVisible()
    await expect(page.getByTestId('nav-calendar')).toBeVisible()
    await expect(page.getByTestId('nav-approvals')).toHaveCount(0)
    await expect(page.getByTestId('nav-settings')).toHaveCount(0)
  })

  test('Manager sees Approvals without Settings', async ({ page }) => {
    await loginViaUi(page, { email: 'alex@company.com', password })

    await expect(page.getByTestId('nav-dashboard')).toBeVisible()
    await expect(page.getByTestId('nav-approvals')).toBeVisible()
    await expect(page.getByTestId('nav-settings')).toHaveCount(0)
  })

  test('HR Admin sees Approvals and Settings', async ({ page }) => {
    await loginViaUi(page, { email: 'jordan@company.com', password })

    await expect(page.getByTestId('nav-approvals')).toBeVisible()
    await expect(page.getByTestId('nav-settings')).toBeVisible()
  })

  test('Employee direct URL to settings redirects to dashboard', async ({ page }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    await navigateInApp(page, '/settings')

    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('nav-dashboard')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Settings' })).toHaveCount(0)
  })

  test('Employee direct URL to approvals redirects to dashboard', async ({ page }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    await navigateInApp(page, '/approvals')

    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('nav-dashboard')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Approvals' })).toHaveCount(0)
  })
})
