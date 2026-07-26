import { test, expect } from '../support/fixtures'
import { loginViaUi, navigateInApp } from '../support/helpers/auth'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

/**
 * Story 3.1 — balance cards on dashboard (FR-3 full-stack regression journey).
 */
test.describe('Dashboard balances — Story 3.1', { tag: [tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running for dashboard data',
  )

  test('[P1] Employee sees annual leave balance card with numbers after login', async ({
    page,
  }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    await navigateInApp(page, '/')

    const annualCard = page.getByTestId('balance-card-annual-leave')
    await expect(annualCard).toBeVisible()
    await expect(annualCard.getByText('17 left')).toBeVisible()
    await expect(annualCard.locator('.balance-total')).toHaveText('/20')
    await expect(annualCard.locator('.balance-used')).toHaveText(
      '3 working days used',
    )
  })
})
