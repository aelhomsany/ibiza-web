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

/** Story 11.3 — cannot-proceed recovery, URL state, and responsive task preservation. */
test.describe(
  'My Leaves findability — Story 11.3',
  { tag: [tags.regression, tags.api, tags.story('11-3')] },
  () => {
    test.skip(
      process.env.E2E_API_AVAILABLE !== 'true',
      'Set E2E_API_AVAILABLE=true when leaveo-api is running for My Leaves data',
    )

    test(
      '[P1] Given filters with no match, Clear Filters restores the list',
      async ({ page }) => {
        await loginViaUi(page, { email: 'sarah@company.com', password })
        await navigateInApp(page, '/my-leaves')

        await expect(page.getByTestId('my-leaves-page')).toBeVisible()
        await expect(page.getByTestId('my-leaves-status-filter')).toBeVisible()
        await expect(page.getByTestId('my-leaves-search')).toBeVisible()

        await page.getByTestId('my-leaves-search').fill('zzzz-no-match-11-3')
        await expect(page.getByTestId('my-leaves-filter-empty')).toBeVisible()
        await expect(page.getByTestId('my-leaves-filter-empty')).toContainText(
          /no requests match these filters/i,
        )
        await expect(page.getByTestId('my-leaves-clear-filters')).toBeVisible()

        await page.getByTestId('my-leaves-clear-filters').click()
        await expect(page.getByTestId('my-leaves-filter-empty')).toHaveCount(0)
        await expect(page.getByTestId('my-leaves-history')).toBeVisible()
        await expect(page.getByTestId('my-leaves-search')).toHaveValue('')
      },
    )

    test(
      '[P0] Given q and status in the URL, When My Leaves loads, Then filters restore and results compose',
      async ({ page }) => {
        await loginViaUi(page, { email: 'sarah@company.com', password })
        await navigateInApp(page, '/my-leaves?status=DECLINED&q=coverage')

        await expect(page.getByTestId('my-leaves-page')).toBeVisible()
        await expect(page.getByTestId('my-leaves-search')).toHaveValue('coverage')

        const statusFilter = page.getByTestId('my-leaves-status-filter')
        await expect(
          statusFilter.getByRole('button', { name: 'Declined' }),
        ).toHaveAttribute('aria-pressed', 'true')
        // Guard against a missing i18n key resolving to the raw namespace key.
        await expect(statusFilter).not.toContainText('common:')

        // Curated demo seed includes a declined request with coverage reason
        await expect(page.getByTestId('my-leaves-history')).toBeVisible()
        await expect(page.getByText(/coverage/i).first()).toBeVisible()
      },
    )

    test(
      '[P0] My Leaves preserves cards/table containment across the required viewport matrix',
      async ({ page }) => {
        await loginViaUi(page, { email: 'sarah@company.com', password })
        await navigateInApp(page, '/my-leaves')
        await expect(page.getByTestId('my-leaves-history')).toBeVisible()

        for (const width of [390, 768, 900, 901, 1280, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          await expectPageDoesNotOverflow(page)

          if (width <= 900) {
            await expect(page.getByTestId('my-leaves-mobile-history')).toBeVisible()
            await expect(page.getByTestId('my-leaves-desktop-history')).toBeHidden()
          } else {
            await expect(page.getByTestId('my-leaves-desktop-history')).toBeVisible()
            await expect(page.getByTestId('my-leaves-mobile-history')).toBeHidden()
          }
        }

        await page.setViewportSize({ width: 390, height: 900 })
        const statusFilter = page.getByTestId('my-leaves-status-filter')
        await expect(statusFilter).toBeVisible()
        // The status segments wrap at narrow widths rather than scrolling sideways — the
        // scrolling strip pushed the card edge past a 375px viewport and hid the last segment
        // (my-leaves.css). So: no sideways overflow, and every segment inside the filter's box.
        await expect
          .poll(() =>
            statusFilter.evaluate((element) => {
              const box = element.getBoundingClientRect()
              const segments = Array.from(element.querySelectorAll('button'))
              return (
                window.getComputedStyle(element).flexWrap === 'wrap' &&
                element.scrollWidth <= element.clientWidth &&
                segments.length > 0 &&
                segments.every((segment) => {
                  const rect = segment.getBoundingClientRect()
                  return rect.left >= box.left - 1 && rect.right <= box.right + 1
                })
              )
            }),
          )
          .toBe(true)
        await expect(page.getByTestId('my-leaves-search')).toBeVisible()
        await expectPageDoesNotOverflow(page)
      },
    )
  },
)
