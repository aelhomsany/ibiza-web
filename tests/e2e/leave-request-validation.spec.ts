import { test, expect } from '../support/fixtures'
import { loginViaUi, navigateInApp } from '../support/helpers/auth'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

/** The next Saturday–Sunday after today, as the ISO dates a native date input accepts. */
function nextWeekend(): { saturday: string; sunday: string } {
  const saturday = new Date()
  saturday.setHours(12, 0, 0, 0)
  saturday.setDate(saturday.getDate() + ((6 - saturday.getDay() + 7) % 7 || 7))
  const sunday = new Date(saturday)
  sunday.setDate(saturday.getDate() + 1)
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return { saturday: iso(saturday), sunday: iso(sunday) }
}

/**
 * FR-6 (P0): Zero working days must block submit with a visible message.
 */
test.describe('Leave request validation — FR-6 zero working days (Story 3.3)', { tag: [tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when leaveo-api is running for leave preview data',
  )

  test('[P0] Given a weekend-only date range, When preview renders, Then submit is blocked with group message', async ({
    page,
  }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    // Sign-in lands on the Team Calendar; the Request Leave button lives on My Leaves.
    await navigateInApp(page, '/my-leaves')

    await page.getByTestId('request-leave-btn').click()
    await expect(page.getByTestId('request-leave-modal')).toBeVisible()

    // US group: Sat–Sun only range → 0 working days. The next weekend rather than a pinned
    // June 2026 pair, which is now in the past.
    const weekend = nextWeekend()
    await page.getByTestId('leave-from-date').fill(weekend.saturday)
    await page.getByTestId('leave-to-date').fill(weekend.sunday)

    await expect(page.getByTestId('working-day-preview')).toContainText(/US Workforce Group/i)
    await expect(page.getByTestId('submit-request-btn')).toBeDisabled()
    await expect(page.getByRole('alert')).toContainText(/No working days/i)
  })
})
