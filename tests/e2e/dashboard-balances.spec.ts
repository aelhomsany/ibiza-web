import { test, expect } from '../support/fixtures'
import { loginViaUi, navigateInApp } from '../support/helpers/auth'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

/**
 * Story 3.1 — balance cards on dashboard (FR-3 smoke).
 */
test.describe('Dashboard balances — Story 3.1', () => {
  test.skip(
    !process.env.E2E_API_AVAILABLE,
    'Set E2E_API_AVAILABLE=true when ibiza-api is running for dashboard data',
  )

  test('[P1] Employee sees annual leave balance card with numbers after login', async ({
    page,
  }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    await navigateInApp(page, '/')

    const annualCard = page.getByTestId('balance-card-annual-leave')
    await expect(annualCard).toBeVisible()
    await expect(annualCard.getByText('20 left')).toBeVisible()
    await expect(annualCard.getByText('/20')).toBeVisible()
  })
})
