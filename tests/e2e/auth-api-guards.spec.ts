import { test, expect } from '../support/fixtures'

const apiUrl = process.env.API_URL ?? process.env.VITE_API_URL ?? 'http://localhost:8080'

test.describe('Authentication API guards', () => {
  test.skip(
    !process.env.E2E_API_AVAILABLE,
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
        timezone: 'America/New_York',
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
