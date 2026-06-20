import { test, expect } from '../support/fixtures'
import { loginViaUi, navigateInApp } from '../support/helpers/auth'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

test.describe('Dashboard recent requests and sidebar — Story 3.2', () => {
  test.skip(!process.env.E2E_API_AVAILABLE, 'Set E2E_API_AVAILABLE=true to run against live API + pilot seed')

  test('[P1] Employee sees recent requests table and out-today sidebar after login', async ({
    page,
  }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    await navigateInApp(page, '/')

    await expect(page.getByTestId('balance-grid')).toBeVisible()
    await expect(page.getByTestId('recent-requests-card')).toBeVisible()
    await expect(page.getByTestId('out-today-sidebar')).toBeVisible()
    await expect(page.getByText('My Recent Requests')).toBeVisible()
    await expect(page.getByText('Out Today')).toBeVisible()
  })

  test('[P1] Pending row shows Waiting for approval hint', async ({ page }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    await navigateInApp(page, '/')

    const pendingRow = page.getByTestId('recent-requests-card').locator('tr.row-pending').first()
    await expect(pendingRow).toBeVisible()
    await expect(pendingRow.getByText('Waiting for approval')).toBeVisible()
    await expect(pendingRow.getByText('Pending')).toBeVisible()
  })

  test('[P1] Out today shows teammate with WFH or Off badge', async ({ page }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    await navigateInApp(page, '/')

    const sidebar = page.getByTestId('out-today-sidebar')
    const badge = sidebar.getByText(/^(WFH|Off)$/).first()
    await expect(badge).toBeVisible()
  })
})
