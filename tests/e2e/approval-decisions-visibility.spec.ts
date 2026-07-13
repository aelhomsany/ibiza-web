import { test, expect } from '../support/fixtures'
import { loginViaUi } from '../support/helpers/auth'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

/**
 * Story 3.8 — sparse E2E for visible pending work (FR-15 / UX-DR24).
 * Pilot seed gives Manager alex@company.com two direct-report pending requests.
 */
test.describe('Approval visibility — Story 3.8', { tag: [tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running for pilot approval seed data',
  )

  test('[P2] Manager sees Approvals badge and dashboard Review Now link', async ({ page }) => {
    await loginViaUi(page, { email: 'alex@company.com', password })

    const badge = page.getByTestId('nav-approvals-badge')
    await expect(badge).toBeVisible()
    await expect(badge).toHaveTextContent('2')

    const alert = page.getByTestId('dashboard-pending-alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('2 Pending Approvals')

    await page.getByRole('link', { name: 'Review Now' }).click()
    await expect(page.getByTestId('approvals-page')).toBeVisible()
    await expect(page.getByTestId('approvals-pending-list')).toBeVisible()
  })
})
