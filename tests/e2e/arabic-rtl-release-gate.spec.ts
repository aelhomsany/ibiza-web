import { test, expect } from '../support/fixtures'
import { loginViaUi } from '../support/helpers/auth'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

/**
 * Story 9.5 — sparse E2E for user-blocking Arabic chrome / document direction.
 * No pixel / screenshot assertions (browser evidence pack is manual).
 *
 * Intentionally skipped: Story 9.5's validation strategy treats the manual
 * browser evidence pack as the release gate and keeps Playwright sparse — no
 * "cannot proceed" gap emerged that required this suite to run in CI. Kept
 * as an opt-in scaffold; enable if a future regression needs this coverage.
 */
test.describe(
  'Arabic RTL release gate — Story 9.5',
  { tag: [tags.regression, tags.uiOnly, tags.story('9-5')] },
  () => {
    test.skip(true, 'Intentionally skipped — browser evidence pack is the release gate, not Playwright')

    test('[P0] Given Arabic preferred, When Employee opens Dashboard, Then Request Leave is Arabic and html dir=rtl (no raw keys)', async ({
      page,
    }) => {
      test.skip(
        process.env.E2E_API_AVAILABLE !== 'true',
        'Set E2E_API_AVAILABLE=true to run against live API + pilot seed',
      )

      await loginViaUi(page, { email: 'sarah@company.com', password })

      await page.getByTestId('language-switcher').click()
      await page.getByRole('menuitemradio', { name: 'العربية' }).click()

      await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

      await expect(page.getByTestId('dashboard-page')).toBeVisible()
      const requestLeave = page.getByTestId('request-leave-btn')
      await expect(requestLeave).toBeVisible()
      await expect(requestLeave).not.toHaveText(/Request Leave/)
      await expect(requestLeave).not.toHaveText(/dashboard:/i)
      await expect(requestLeave).toContainText(/طلب/)
    })
  },
)
