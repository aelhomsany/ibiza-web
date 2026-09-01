import { test, expect } from '../support/fixtures'
import { loginViaUi, navigateInApp } from '../support/helpers/auth'
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

  test('[P2] Manager sees Approvals badge and My Leaves Review Now link', async ({ page }) => {
    // The badge and the My Leaves callout must agree with each other and with the inbox. This
    // used to assert a literal "2" — the number the demo seed happens to create — using
    // `toHaveTextContent`, a jest-dom matcher that does not exist in Playwright's expect and
    // threw TypeError before it could compare anything, so the count had never been checked.
    //
    // It is asserted as an internal invariant rather than against a number fetched beforehand:
    // approval-decision.spec.ts provisions and consumes its own pending requests, so any count
    // read before the page loads can be stale by the time it renders, and pinning the seed's 2
    // is wrong for the same reason. Badge, callout and inbox all derive from one query in one
    // render, so requiring them to match is concurrency-proof — and it catches a badge that
    // disagrees with the inbox at ANY count, which "2" never could. The floor keeps the curated
    // fixture honest: if the seeded pending requests vanish, this still fails.
    await loginViaUi(page, { email: 'alex@company.com', password })
    // Sign-in now lands on the Team Calendar, which carries no attention callout —
    // the callout moved to My Leaves with the Dashboard merge (2026-09-01).
    await navigateInApp(page, '/my-leaves')

    const badge = page.getByTestId('nav-approvals-badge')
    await expect(badge).toBeVisible()
    const badgeCount = Number((await badge.textContent())?.trim())
    expect(badgeCount, 'the curated seed must leave the manager at least two pending requests')
      .toBeGreaterThanOrEqual(2)

    // dashboard-attention, not dashboard-pending-alert: Story 11.2 replaced the alert with the
    // shared AttentionCallout, whose default testId is still 'dashboard-attention' after the
    // Dashboard merge — the component kept its name, only its host screen changed. Epic 11's
    // retro item 5 migrated this selector in the specs it touched and missed this one. The copy
    // is now i18n-pluralised lowercase ("2 pending approvals").
    const alert = page.getByTestId('dashboard-attention')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(`${badgeCount} pending approval`)

    await page.getByRole('link', { name: 'Review Now' }).click()
    await expect(page.getByTestId('approvals-page')).toBeVisible()
    // The inbox is asserted non-empty rather than equal to badgeCount: the badge was read on the
    // My Leaves page and this list renders after a navigation, so another spec approving or declining
    // in between would make an equality check fail for a correct application. Badge and callout
    // above ARE compared exactly, because they come from one query in one render.
    const pendingList = page.getByTestId('approvals-pending-list')
    await expect(pendingList).toBeVisible()
    expect(await pendingList.getByTestId(/^approval-card-\d+$/).count()).toBeGreaterThan(0)
  })
})
