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
      'Set E2E_API_AVAILABLE=true when ibiza-api is running for pilot dashboard data',
    )

    for (const width of [768, 900, 1280, 1440] as const) {
      test(
        `[P0] Dashboard has no page-level overflow at ${width}px`,
        async ({ page }) => {
          await loginViaUi(page, { email: 'sarah@company.com', password })
          await page.setViewportSize({ width, height: 900 })
          await navigateInApp(page, '/')

          await expect(page.getByTestId('recent-requests-card')).toBeVisible()
          await expectPageDoesNotOverflow(page)
        },
      )
    }
  },
)
