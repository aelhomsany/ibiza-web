import { test, expect } from '../support/fixtures'
import { loginViaUi } from '../support/helpers/auth'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

test.describe('Notification bell — Story 5.1 / 7.11', () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running for notification data',
  )

  test('[P1] Org user opens notification panel from bell', async ({ page }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })

    await expect(page.getByTestId('notification-bell')).toBeVisible()
    await page.getByTestId('notification-bell').click()

    const panel = page.getByTestId('notification-panel')
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Mark all read' })).toBeVisible()
  })
})
