import { test, expect } from '../support/fixtures'
import { createHmac } from 'node:crypto'
import type { APIRequestContext } from '@playwright/test'
import { loginViaApi } from '../support/helpers/auth'
import { apiRequest } from '../support/helpers/api-client'

const platformAdminCredentials = {
  email: process.env.E2E_PLATFORM_ADMIN_EMAIL ?? 'riley@ibiza.app',
  password: process.env.E2E_PLATFORM_ADMIN_PASSWORD ?? 'PilotDev123!',
}

type OrganizationSummary = {
  id: number
  name: string
}

test.describe('Team member plan limit', () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running with pilot seed data',
  )

  test('[P0] HR blocked adding over-limit Free user sees warning toast and modal stays open', async ({
    page,
    request,
  }) => {
    const suffix = Date.now()
    const orgName = `Free Limit E2E ${suffix}`
    const hrEmail = `hr.limit.e2e.${suffix}@example.com`
    const { accessToken: platformToken } = await loginViaApi(request, platformAdminCredentials)
    const org = await apiRequest<OrganizationSummary>({
      request,
      method: 'POST',
      path: '/api/v1/platform/organizations',
      token: platformToken,
      data: {
        name: orgName,
        primaryContact: 'Fatima Hassan',
        initialHrAdminEmail: hrEmail,
        plan: 'FREE',
      },
    })

    const hrToken = signHrToken(org.id)
    const groups = await apiRequest<Array<{ id: number; name: string }>>({
      request,
      method: 'GET',
      path: '/api/v1/workforce-groups',
      token: hrToken,
    })
    const groupId = groups[0]?.id
    expect(groupId).toBeTruthy()

    await createMember(request, hrToken, groupId!, `user1.${suffix}@example.com`)
    await createMember(request, hrToken, groupId!, `user2.${suffix}@example.com`)

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: hrToken,
          refreshToken: 'playwright-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 900,
        }),
      })
    })
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          email: hrEmail,
          fullName: 'Limit Test HR',
          role: 'HR_ADMIN',
          organizationId: org.id,
          timezone: 'America/New_York',
        }),
      })
    })

    await page.goto('/settings')
    await page.getByTestId('add-member-btn').click()
    await expect(page.getByText('Add Team Member')).toBeVisible()

    await page.getByLabel(/Full name/i).fill('Fourth User')
    await page.getByLabel(/Email/i).fill(`fourth.${suffix}@example.com`)
    await page.getByLabel(/Department/i).fill('Ops')
    await page.getByLabel(/Workforce Group/i).selectOption({ index: 1 })
    await page.getByRole('button', { name: /Save/i }).click()

    const toast = page.getByTestId('app-toast')
    await expect(toast).toContainText(
      `${orgName} is at the 3-user Free limit`,
    )
    await expect(toast).toHaveAttribute('data-tone', 'warning')
    await expect(page.getByText('Add Team Member')).toBeVisible()
  })
})

async function createMember(
  request: APIRequestContext,
  token: string,
  groupId: number,
  email: string,
) {
  await apiRequest({
    request,
    method: 'POST',
    path: '/api/v1/team-members',
    token,
    data: {
      fullName: 'Seed User',
      email,
      department: 'Ops',
      role: 'EMPLOYEE',
      workforceGroupId: groupId,
    },
  })
}

function signHrToken(orgId: number): string {
  const secret = process.env.JWT_SECRET ?? 'dev-only-jwt-secret-change-before-pilot-min-32-chars'
  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64Url(
    JSON.stringify({
      sub: '1',
      orgId,
      role: 'HR_ADMIN',
      iat: now,
      exp: now + 900,
    }),
  )
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url')
  return `${header}.${payload}.${signature}`
}

function base64Url(value: string): string {
  return Buffer.from(value).toString('base64url')
}
