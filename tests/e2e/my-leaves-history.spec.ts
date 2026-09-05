import { test, expect } from '../support/fixtures'
import { loginViaUi, navigateInApp } from '../support/helpers/auth'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

/**
 * Story 3.5 — My Leaves full history page (FR-8 full-stack regression journey).
 */
test.describe('My Leaves history — Story 3.5', { tag: [tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when leaveo-api is running for My Leaves data',
  )

  test('[P2] Employee sees My Leaves balances, history, and shared request CTA', async ({
    page,
  }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    await navigateInApp(page, '/my-leaves')

    await expect(page.getByTestId('my-leaves-page')).toBeVisible()
    await expect(page.getByTestId('my-leaves-balance-grid')).toBeVisible()
    await expect(page.getByTestId('my-leaves-history-table')).toBeVisible()
    await expect(
      page
        .getByTestId('my-leaves-history-table')
        .getByText(/Waiting for approval|Approved by|Declined/i)
        .first(),
    ).toBeVisible()

    await page.getByTestId('request-leave-btn').click()
    await expect(page.getByTestId('request-leave-modal')).toBeVisible()
  })
})
