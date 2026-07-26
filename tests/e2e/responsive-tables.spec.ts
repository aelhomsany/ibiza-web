import { expect, test, type Locator, type Page } from '@playwright/test'

import { loginViaUi, navigateInApp } from '../support/helpers/auth'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'
const mobileViewport = { width: 375, height: 812 }

type TableReachabilityTarget = {
  wrapper: Locator
  trailingCell: Locator
}

async function expectPageDoesNotOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    )
    .toBe(true)
}

async function expectTrailingColumnReachable({
  wrapper,
  trailingCell,
}: TableReachabilityTarget): Promise<void> {
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

  await wrapper.evaluate((element) => {
    const direction = window.getComputedStyle(element).direction
    const scrollEnd = element.scrollWidth - element.clientWidth
    element.scrollLeft = direction === 'rtl' ? -scrollEnd : scrollEnd
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

async function viewPageAtMobileWidth(page: Page, path: string): Promise<void> {
  await page.setViewportSize(mobileViewport)
  await navigateInApp(page, path)
}

/**
 * Story 10.3 — Responsive tables.
 */
test.describe('Responsive tables — Story 10.3', { tag: [tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running for pilot table data',
  )

  test('[P0] Dashboard recent requests scroll inside the table wrapper at 375px', async ({
    page,
  }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    await viewPageAtMobileWidth(page, '/')

    const card = page.getByTestId('recent-requests-card')
    await expect(card).toBeVisible()

    await expectTrailingColumnReachable({
      wrapper: card.locator('.table-wrap'),
      trailingCell: card.locator('tbody tr').first().locator('td').last(),
    })
    await expectPageDoesNotOverflow(page)
  })

  test('[P0] My Leaves history uses task cards without page overflow at 375px', async ({
    page,
  }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    await viewPageAtMobileWidth(page, '/my-leaves')

    const desktopHistory = page.getByTestId('my-leaves-desktop-history')
    const mobileHistory = page.getByTestId('my-leaves-mobile-history')
    await expect(desktopHistory).toBeHidden()
    await expect(mobileHistory).toBeVisible()
    const firstCard = mobileHistory.locator('[data-testid^="my-leaves-request-card-"]').first()
    await expect(firstCard).toBeVisible()
    await expect(firstCard).toContainText(/working day/i)
    await expect(firstCard.locator('.badge')).toBeVisible()
    await expect(firstCard.getByRole('button', { name: /details/i })).toBeVisible()
    await expectPageDoesNotOverflow(page)
  })

  test('[P0] Approvals recent decisions expose the decision date at 375px', async ({
    page,
  }) => {
    // Uses the HR Admin's org-wide seeded recent decisions, including the Audit
    // column, rather than consuming the pilot seed's limited pending-request budget.
    await loginViaUi(page, { email: 'jordan@company.com', password })
    await viewPageAtMobileWidth(page, '/approvals')

    const wrapper = page.getByTestId('recent-decisions-table')
    await expect(wrapper).toBeVisible()

    await expectTrailingColumnReachable({
      wrapper,
      trailingCell: wrapper.locator('tbody tr').first().locator('td').last(),
    })
    await expectPageDoesNotOverflow(page)
  })
})
