import { test, expect } from '../support/fixtures'
import { loginViaApi, pilotCredentials } from '../support/helpers/auth'
import { tags } from '../support/tags'

test.describe('Authentication API', { tag: [tags.smoke, tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running for API auth checks',
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
    'Set E2E_API_AVAILABLE=true when ibiza-api is running for UI auth checks',
  )

  test('Given the login page, When signing in with valid credentials, Then dashboard loads', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByTestId('sign-in-email').fill(pilotCredentials.email)
    await page.getByTestId('sign-in-password').fill(pilotCredentials.password)
    await page.getByTestId('sign-in-submit').click()
    await expect(page.getByTestId('nav-dashboard')).toBeVisible()
  })
})
