import { test, expect } from '../support/fixtures'
import { loginViaUi } from '../support/helpers/auth'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

/**
 * FR-6 (P0): Zero working days must block submit with a visible message.
 */
test.describe('Leave request validation — FR-6 zero working days (Story 3.3)', { tag: [tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running for leave preview data',
  )

  test('[P0] Given a weekend-only date range, When preview renders, Then submit is blocked with group message', async ({
    page,
  }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })

    await page.getByTestId('request-leave-btn').click()
    await expect(page.getByTestId('request-leave-modal')).toBeVisible()

    // US group: Sat–Sun only range → 0 working days
    await page.getByTestId('leave-from-date').fill('2026-06-06')
    await page.getByTestId('leave-to-date').fill('2026-06-07')

    await expect(page.getByTestId('working-day-preview')).toContainText(/US Workforce Group/i)
    await expect(page.getByTestId('submit-request-btn')).toBeDisabled()
    await expect(page.getByRole('alert')).toContainText(/No working days/i)
  })
})
