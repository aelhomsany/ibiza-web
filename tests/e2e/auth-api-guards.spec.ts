import { test, expect } from '../support/fixtures'
import { tags } from '../support/tags'

const apiUrl = process.env.API_URL ?? process.env.VITE_API_URL ?? 'http://localhost:8080'

test.describe('Authentication API guards', { tag: [tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running for API guard checks',
  )

  test('[P0-001] Given no token, When calling /auth/me, Then 401 is returned', async ({ request }) => {
    const response = await request.get(`${apiUrl}/api/v1/auth/me`)
    expect(response.status()).toBe(401)
  })

  test('[P0-002] Given valid login, When calling /auth/me, Then org-scoped user is returned', async ({
    request,
  }) => {
    const loginResponse = await request.post(`${apiUrl}/api/v1/auth/login`, {
      data: {
        email: process.env.E2E_USER_EMAIL ?? 'alex@company.com',
        password: process.env.E2E_USER_PASSWORD ?? 'PilotDev123!',
        // Africa/Cairo matches how DemoScenarioSeeder seeds this account. Login persists the
        // timezone it is given, so signing a seeded user in with a different one rewrote their
        // row mid-suite — mutating curated demo data this spec does not own, and taking a write
        // lock that deadlocked (MySQL 1213) against concurrent sign-ins by the same account,
        // surfacing as 500s from /auth/login. Timezone capture itself stays covered
        // authoritatively by AuthIntegrationTest#loginPersistsTimezoneAndReLoginOverwritesIt.
        timezone: 'Africa/Cairo',
      },
    })
    expect(loginResponse.ok()).toBeTruthy()

    const { accessToken } = await loginResponse.json()
    const meResponse = await request.get(`${apiUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    expect(meResponse.ok()).toBeTruthy()
    const me = await meResponse.json()
    expect(me.email).toBe(process.env.E2E_USER_EMAIL ?? 'alex@company.com')
    expect(me.organizationId).toBeTruthy()
  })
})
