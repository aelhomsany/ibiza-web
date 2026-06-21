import { test, expect } from '../support/fixtures'
import { loginViaUi, navigateInApp } from '../support/helpers/auth'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

/**
 * Story 3.7 — sparse E2E for approve happy path + decline reason guard (FR-13 / UX-DR18).
 * Runs in CI via the ibiza-web `e2e-with-api` job (`E2E_API_AVAILABLE=true`).
 */
test.describe('Approval decision — Story 3.7', () => {
  test.skip(
    !process.env.E2E_API_AVAILABLE,
    'Set E2E_API_AVAILABLE=true when ibiza-api is running for pilot approval seed data',
  )

  test('[P1] Manager approves a pending row and it disappears from the inbox', async ({ page }) => {
    await loginViaUi(page, { email: 'alex@company.com', password })
    await navigateInApp(page, '/approvals')

    await expect(page.getByTestId('approvals-page')).toBeVisible()
    const firstApprove = page.getByTestId(/approve-btn-/).first()
    await expect(firstApprove).toBeEnabled()

    const rowTestId = await firstApprove.evaluate(
      (el) => el.getAttribute('data-testid')?.replace('approve-btn-', 'approval-row-') ?? '',
    )

    await firstApprove.click()
    await expect(page.getByRole('status')).toContainText(/approved/i)
    await expect(page.getByTestId(rowTestId)).toHaveCount(0)
  })

  test('[P1] Decline confirm is blocked until a reason is entered', async ({ page }) => {
    await loginViaUi(page, { email: 'alex@company.com', password })
    await navigateInApp(page, '/approvals')

    await page.getByTestId(/decline-btn-/).first().click()
    await expect(page.getByTestId('decline-modal')).toBeVisible()
    await expect(page.getByTestId('decline-confirm-btn')).toBeDisabled()

    await page.getByTestId('decline-reason-input').fill('Coverage gap that week')
    await expect(page.getByTestId('decline-confirm-btn')).toBeEnabled()
  })

  test('[P1] Manager declines a pending row and it disappears from the inbox', async ({ page }) => {
    await loginViaUi(page, { email: 'alex@company.com', password })
    await navigateInApp(page, '/approvals')

    const firstDecline = page.getByTestId(/decline-btn-/).first()
    await expect(firstDecline).toBeEnabled()

    const rowTestId = await firstDecline.evaluate(
      (el) => el.getAttribute('data-testid')?.replace('decline-btn-', 'approval-row-') ?? '',
    )

    await firstDecline.click()
    await page.getByTestId('decline-reason-input').fill('Coverage gap that week')
    await page.getByTestId('decline-confirm-btn').click()
    await expect(page.getByRole('status')).toContainText(/declined/i)
    await expect(page.getByTestId(rowTestId)).toHaveCount(0)
  })
})
