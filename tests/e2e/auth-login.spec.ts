import { test, expect } from '../support/fixtures'
import { loginViaApi, pilotCredentials } from '../support/helpers/auth'
import { tags } from '../support/tags'

test.describe('Authentication API', { tag: [tags.smoke, tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when leaveo-api is running for API auth checks',
  )

  test('Given pilot credentials, When logging in via API, Then an access token is returned', async ({
    request,
  }) => {
    const tokens = await loginViaApi(request, pilotCredentials)
    expect(tokens.accessToken).toBeTruthy()
    expect(tokens.tokenType).toBe('Bearer')
  })
})

test.describe('Authentication UI', { tag: [tags.smoke, tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when leaveo-api is running for UI auth checks',
  )

  test('Given the login page, When signing in with valid credentials, Then the team calendar loads', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByTestId('sign-in-email').fill(pilotCredentials.email)
    await page.getByTestId('sign-in-password').fill(pilotCredentials.password)
    await page.getByTestId('sign-in-submit').click()
    // getHomePath sends org roles to the Team Calendar since the Dashboard merged
    // into My Leaves (2026-09-01). Asserting the page, not just the nav item, keeps
    // this a real landing check rather than a shell-rendered check.
    await expect(page.getByTestId('nav-calendar')).toBeVisible()
    await expect(page.getByTestId('team-calendar-page')).toBeVisible()
  })
})
