import { expect, test, type Locator, type Page } from '@playwright/test'

import { loginViaUi, navigateInApp } from '../support/helpers/auth'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

async function expectPageDoesNotOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    )
    .toBe(true)
}

async function expectTrailingColumnKeyboardReachable(
  wrapper: Locator,
  trailingCell: Locator,
): Promise<void> {
  await expect(wrapper).toBeVisible()
  await expect(wrapper.locator('table')).toBeVisible()

  const metrics = await wrapper.evaluate((element) => {
    const style = window.getComputedStyle(element)
    return {
      clientWidth: element.clientWidth,
      overflowX: style.overflowX,
      scrollWidth: element.scrollWidth,
    }
  })

  expect(metrics.overflowX).toBe('auto')
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth)

  await wrapper.focus()
  await expect(wrapper).toBeFocused()
  await wrapper.press('ArrowRight')
  await expect
    .poll(() => wrapper.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0)

  await wrapper.evaluate((element) => {
    element.scrollLeft = element.scrollWidth
  })
  await expect(trailingCell).toBeVisible()

  const wrapperBox = await wrapper.boundingBox()
  const cellBox = await trailingCell.boundingBox()
  expect(wrapperBox, 'table wrapper must have a rendered box').not.toBeNull()
  expect(cellBox, 'trailing column cell must have a rendered box').not.toBeNull()
  expect(cellBox!.x).toBeGreaterThanOrEqual(wrapperBox!.x - 1)
  expect(cellBox!.x + cellBox!.width).toBeLessThanOrEqual(
    wrapperBox!.x + wrapperBox!.width + 1,
  )
}

/**
 * Story 10.9 — Responsive containment and mobile navigation surfaces.
 */
test.describe(
  'Responsive containment — Story 10.9',
  { tag: [tags.regression, tags.api, tags.story('10-9')] },
  () => {
    test.skip(
      process.env.E2E_API_AVAILABLE !== 'true',
      'Set E2E_API_AVAILABLE=true when ibiza-api is running for pilot dashboard/settings data',
    )

    // 390px and 901px bracket the 900px shell breakpoint. The Dashboard merged into
    // My Leaves on 2026-09-01, so the screen Story 10.9 guarded is now My Leaves —
    // and the Team Calendar inherited the landing-page role, which is where a
    // containment regression would hit users first.
    test('[P0] My Leaves has no page-level overflow at 390px', async ({ page }) => {
      await loginViaUi(page, { email: 'sarah@company.com', password })
      await page.setViewportSize({ width: 390, height: 844 })
      await navigateInApp(page, '/my-leaves')

      await expect(page.getByTestId('my-leaves-history')).toBeVisible()
      await expectPageDoesNotOverflow(page)
    })

    test('[P0] My Leaves has no page-level overflow at 901px', async ({ page }) => {
      await loginViaUi(page, { email: 'sarah@company.com', password })
      await page.setViewportSize({ width: 901, height: 844 })
      await navigateInApp(page, '/my-leaves')

      await expect(page.getByTestId('my-leaves-history')).toBeVisible()
      await expect(page.getByTestId('my-leaves-support-rail')).toBeVisible()
      await expectPageDoesNotOverflow(page)
    })

    test('[P0] Team Calendar has no page-level overflow at 390px', async ({ page }) => {
      await loginViaUi(page, { email: 'sarah@company.com', password })
      await page.setViewportSize({ width: 390, height: 844 })
      await navigateInApp(page, '/calendar')

      await expect(page.getByTestId('calendar-out-today')).toBeVisible()
      await expectPageDoesNotOverflow(page)
    })

    test(
      '[P0] Settings Workforce Group navigation is fully reachable at 390px',
      async ({ page }) => {
        // HR Admin pilot user (jordan); sarah is EMPLOYEE and cannot open Settings.
        await loginViaUi(page, { email: 'jordan@company.com', password })
        await page.setViewportSize({ width: 390, height: 844 })
        await navigateInApp(page, '/settings')

        const card = page.getByTestId('workforce-groups-weekends-card')
        await expect(card).toBeVisible()

        const tablist = card.getByRole('tablist', { name: /workforce groups/i })
        await expect(tablist).toBeVisible()
        await expect
          .poll(() => tablist.evaluate((element) => window.getComputedStyle(element).overflowX))
          .toBe('auto')

        const tabs = card.getByRole('tab')
        await expect(tabs.first()).toBeVisible()
        const lastTab = tabs.last()
        await lastTab.scrollIntoViewIfNeeded()
        await expect(lastTab).toBeVisible()

        const cardBox = await card.boundingBox()
        const tabBox = await lastTab.boundingBox()
        expect(cardBox, 'settings card must have a rendered box').not.toBeNull()
        expect(tabBox, 'last group tab must have a rendered box').not.toBeNull()

        // Tab must sit inside the card (no clip by overflow:hidden).
        expect(tabBox!.x).toBeGreaterThanOrEqual(cardBox!.x - 1)
        expect(tabBox!.x + tabBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1)
        expect(tabBox!.y).toBeGreaterThanOrEqual(cardBox!.y - 1)
        expect(tabBox!.y + tabBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height + 1)
        await expectPageDoesNotOverflow(page)
      },
    )

    test(
      '[P1] My Leaves history preserves primary facts in cards at 390px',
      async ({ page }) => {
        await loginViaUi(page, { email: 'sarah@company.com', password })
        await page.setViewportSize({ width: 390, height: 844 })
        await navigateInApp(page, '/my-leaves')

        const card = page.getByTestId('my-leaves-history')
        await expect(card).toBeVisible()

        const tableView = card.getByTestId('my-leaves-desktop-history')
        await expect(tableView).toBeAttached()
        await expect(tableView).toBeHidden()

        const mobileCards = card.getByTestId('my-leaves-mobile-history')
        const firstMobileCard = mobileCards.getByTestId(
          /my-leaves-request-card-\d+/,
        ).first()
        await expect(mobileCards).toBeVisible()
        await expect(firstMobileCard).toBeVisible()
        await expect(firstMobileCard).toContainText(/working day/i)
        await expect(firstMobileCard.locator('.badge')).toBeVisible()
        await expectPageDoesNotOverflow(page)
      },
    )

    test(
      '[P1] My Leaves history keeps the trailing desktop column keyboard-reachable',
      async ({ page }) => {
        await loginViaUi(page, { email: 'sarah@company.com', password })
        await page.setViewportSize({ width: 1280, height: 900 })
        await navigateInApp(page, '/my-leaves')

        const card = page.getByTestId('my-leaves-history')
        const tableView = card.getByTestId('my-leaves-desktop-history')
        // my-leaves-history-table IS the HorizontalScrollRegion (role="region",
        // tabindex="0") — the My Leaves equivalent of recent-requests-scroll-region.
        const region = card.getByTestId('my-leaves-history-table')
        await expect(tableView).toBeVisible()
        await expectTrailingColumnKeyboardReachable(
          region,
          region.locator('tbody tr').first().locator('td').last(),
        )
        await expectPageDoesNotOverflow(page)
      },
    )
  },
)
