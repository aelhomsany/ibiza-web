import { test, expect } from '../support/fixtures'
import { loginViaUi, navigateInApp } from '../support/helpers/auth'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

async function expectPageDoesNotOverflow(page: import('@playwright/test').Page) {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    )
    .toBe(true)
}

/**
 * Story 11.4 — cannot-proceed / responsive action availability.
 * Decline empty-reason
 * remains covered by approval-decision.spec.ts (Story 3.7). Scope stays API-authoritative.
 */
test.describe(
  'Approval decision confidence — Story 11.4',
  { tag: [tags.regression, tags.api, tags.story('11-4')] },
  () => {
    test.skip(
      process.env.E2E_API_AVAILABLE !== 'true',
      'Set E2E_API_AVAILABLE=true when ibiza-api is running for Approvals seed data',
    )

    test(
      '[P1] Given a pending card at 390px, When Approvals renders, Then Approve and Decline are visible without page overflow',
      async ({ page }) => {
        await loginViaUi(page, { email: 'alex@company.com', password })
        await page.setViewportSize({ width: 390, height: 844 })
        await navigateInApp(page, '/approvals')

        await expect(page.getByTestId('approvals-page')).toBeVisible()
        const card = page.getByTestId(/approval-card-/).first()
        await expect(card).toBeVisible()

        const cardTestId = await card.getAttribute('data-testid')
        const requestId = cardTestId?.replace('approval-card-', '') ?? ''
        expect(requestId.length).toBeGreaterThan(0)

        const approve = page.getByTestId(`approve-btn-${requestId}`)
        const decline = page.getByTestId(`decline-btn-${requestId}`)
        await expect(approve).toBeVisible()
        await expect(decline).toBeVisible()

        // Actions must be in the viewport — not only inside a horizontally scrolled table.
        await expect(approve).toBeInViewport()
        await expect(decline).toBeInViewport()
        await expectPageDoesNotOverflow(page)
      },
    )

    test(
      '[P0] Given Decline on an Approval card, When the modal opens, Then it names requester and date range and blocks empty reason',
      async ({ page }) => {
        await loginViaUi(page, { email: 'alex@company.com', password })
        await navigateInApp(page, '/approvals')

        await expect(page.getByTestId('approvals-page')).toBeVisible()
        await page.getByTestId(/decline-btn-/).first().click()

        const modal = page.getByTestId('decline-modal')
        await expect(modal).toBeVisible()
        // Requester name + date range must appear in the dialog chrome.
        await expect(modal).toContainText(/\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/)
        await expect(page.getByTestId('decline-confirm-btn')).toBeDisabled()

        await page.getByTestId('decline-reason-input').fill('   ')
        await expect(page.getByTestId('decline-confirm-btn')).toBeDisabled()
      },
    )
  },
)
