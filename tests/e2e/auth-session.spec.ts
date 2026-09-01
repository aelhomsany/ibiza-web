import { test, expect } from '../support/fixtures'
import { loginViaUi, logoutViaUi, navigateInApp, pilotCredentials } from '../support/helpers/auth'
import { tags } from '../support/tags'

test.describe('Auth session security', { tag: [tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running for auth session checks',
  )

  test('[P0-012] Given a signed-in user, When signing out, Then login page is shown', async ({ page }) => {
    await loginViaUi(page, pilotCredentials)
    await logoutViaUi(page)
  })

  test('[P0-012] Given a signed-out user, When visiting a protected route, Then login page is shown', async ({
    page,
  }) => {
    await loginViaUi(page, pilotCredentials)
    await logoutViaUi(page)

    await page.goto('/')
    await expect(page.getByTestId('login-page')).toBeVisible()
    await expect(page.getByTestId('nav-calendar')).toHaveCount(0)
  })

  test('[P0-012] Given a failed session restore, When reloading the app, Then login page is shown', async ({
    page,
  }) => {
    await loginViaUi(page, pilotCredentials)

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'https://ibiza.app/errors/unauthorized',
          status: 401,
          title: 'Unauthorized',
          detail: 'Session expired',
        }),
      })
    })

    await page.reload()
    await expect(page.getByTestId('login-page')).toBeVisible()
    await expect(page.getByTestId('nav-calendar')).toHaveCount(0)
  })

  test('[P0-012] Given a signed-in user, When signing out, Then in-app navigation to the home route shows login', async ({
    page,
  }) => {
    await loginViaUi(page, pilotCredentials)
    await logoutViaUi(page)

    await navigateInApp(page, '/')
    await expect(page.getByTestId('login-page')).toBeVisible()
  })
})
