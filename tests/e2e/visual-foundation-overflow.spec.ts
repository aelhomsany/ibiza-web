import { expect, test } from '@playwright/test'

import { loginViaUi, navigateInApp } from '../support/helpers/auth'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

async function expectPageDoesNotOverflow(page: import('@playwright/test').Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    )
    .toBe(true)
}

/**
 * Story 11.1 — Visual foundation overflow matrix.
 * Story 10.9 already covers 390/901; these widths complete UX-DR36 and keep the API availability gate.
 */
test.describe(
  'Visual foundation overflow — Story 11.1',
  { tag: [tags.regression, tags.api, tags.story('11-1')] },
  () => {
    test.skip(
      process.env.E2E_API_AVAILABLE !== 'true',
      'Set E2E_API_AVAILABLE=true when leaveo-api is running for pilot dashboard data',
    )

    // The Dashboard merged into My Leaves on 2026-09-01, splitting Story 11.1's one
    // overflow-prone screen into two: the Team Calendar (the landing page, carrying a
    // wide timeline grid) and My Leaves (carrying the history table and a 300px support
    // rail that has to fit beside it). Both are checked at every width, because the
    // rail/table pairing is exactly the composition this story exists to protect.
    for (const width of [768, 900, 1280, 1440] as const) {
      test(
        `[P0] Team Calendar has no page-level overflow at ${width}px`,
        async ({ page }) => {
          // Viewport first: the Team Calendar is the landing page and decides Agenda vs
          // Timeline once, when it mounts. Sign-in already renders it, and navigating to the
          // route it is on does not remount it, so a later resize would leave the desktop
          // Timeline in place at 768/900.
          await page.setViewportSize({ width, height: 900 })
          await loginViaUi(page, { email: 'sarah@company.com', password })
          await navigateInApp(page, '/calendar')

          // The Out Today strip renders in both views, so it is the width-independent
          // proof the page actually loaded. The view itself is not: Story 11.6 opens
          // the calendar in Agenda under `(max-width: 900px)` and Timeline above it, so
          // asserting the timeline's scroll wrap at 768/900 would fail on a correct
          // build. Each width asserts the container it genuinely renders.
          await expect(page.getByTestId('calendar-out-today')).toBeVisible()
          await expect(
            page.getByTestId(width <= 900 ? 'calendar-agenda' : 'calendar-scroll-wrap'),
          ).toBeVisible()
          await expectPageDoesNotOverflow(page)
        },
      )

      test(
        `[P0] My Leaves has no page-level overflow at ${width}px`,
        async ({ page }) => {
          await loginViaUi(page, { email: 'sarah@company.com', password })
          await page.setViewportSize({ width, height: 900 })
          await navigateInApp(page, '/my-leaves')

          await expect(page.getByTestId('my-leaves-history')).toBeVisible()
          await expect(page.getByTestId('my-leaves-support-rail')).toBeVisible()
          await expectPageDoesNotOverflow(page)
        },
      )
    }
  },
)
