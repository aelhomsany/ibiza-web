import { expect, test } from '@playwright/test'

import { loginViaUi, navigateInApp } from '../support/helpers/auth'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

/**
 * Story 10.10 — sparse behavioral E2E for skip link and mobile drawer focus scope.
 */
test.describe(
  'Accessibility completion — Story 10.10',
  { tag: [tags.regression, tags.uiOnly, tags.story('10-10')] },
  () => {
    test.skip(
      process.env.E2E_API_AVAILABLE !== 'true',
      'Set E2E_API_AVAILABLE=true when ibiza-api is running for authenticated shell navigation',
    )

    test('[P1] Skip link moves focus to main content', async ({ page }) => {
      await loginViaUi(page, { email: 'sarah@company.com', password })
      await navigateInApp(page, '/')

      await page.keyboard.press('Tab')

      const skipLink = page.getByRole('link', { name: /skip to main/i })
      await expect(skipLink).toBeFocused()

      await page.keyboard.press('Enter')

      const main = page.locator('#main-content')
      await expect(main).toBeFocused()
    })

    test('[P0] Mobile drawer constrains focus away from header actions', async ({ page }) => {
      await loginViaUi(page, { email: 'jordan@company.com', password })
      await page.setViewportSize({ width: 390, height: 844 })
      await navigateInApp(page, '/')

      await page.getByTestId('shell-topbar-menu').click()
      await expect(page.getByTestId('sidebar')).toBeVisible()

      const bell = page.getByTestId('notification-bell')
      const userMenu = page.getByTestId('user-menu-trigger')

      const assertHeaderActionNotFocused = async (label: string) => {
        const focused = await page.evaluate(() => {
          const active = document.activeElement
          return active?.getAttribute('data-testid') ?? active?.tagName ?? ''
        })
        expect(
          focused,
          `${label} must not receive focus while the mobile drawer is open (focused: ${focused})`,
        ).not.toMatch(/notification-bell|user-menu-trigger/)
      }

      // Cycle Tab from the first focused nav link through the drawer trap.
      for (let step = 0; step < 12; step += 1) {
        await assertHeaderActionNotFocused('Header action')
        await page.keyboard.press('Tab')
      }

      await expect(bell).toBeVisible()
      await expect(userMenu).toBeVisible()
      await expect(bell).not.toBeFocused()
      await expect(userMenu).not.toBeFocused()
    })
  },
)
