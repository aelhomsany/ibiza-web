import { test, expect } from '../support/fixtures'
import { loginViaUi, navigateInApp } from '../support/helpers/auth'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

/**
 * Story 3.6 — Manager approval inbox smoke (FR-14).
 */
test.describe('Approval inbox — Story 3.6', () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running for pilot approval seed data',
  )

  test('[P2] Manager sees direct-report pending row on Approvals page', async ({ page }) => {
    await loginViaUi(page, { email: 'alex@company.com', password })
    await navigateInApp(page, '/approvals')

    await expect(page.getByTestId('approvals-page')).toBeVisible()
    await expect(page.getByTestId('approvals-pending-list')).toBeVisible()
    await expect(page.getByText('Sarah Chen')).toBeVisible()
    await expect(page.getByText(/Annual Leave/i)).toBeVisible()
    await expect(page.getByTestId(/approve-btn-/)).toBeVisible()
    await expect(page.getByTestId(/decline-btn-/)).toBeVisible()
  })
})
