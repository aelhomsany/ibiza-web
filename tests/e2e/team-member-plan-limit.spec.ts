import { test, expect } from '../support/fixtures'
import type { APIRequestContext } from '@playwright/test'
import { loginPlatformViaApi, loginViaApi, loginViaUi } from '../support/helpers/auth'
import { apiRequest } from '../support/helpers/api-client'
import { initialPasswordTokenFor } from '../support/helpers/registration-mail'
import { tags } from '../support/tags'

const platformAdminCredentials = {
  email: process.env.E2E_PLATFORM_ADMIN_EMAIL ?? 'riley@leaveo.example',
  password: process.env.E2E_PLATFORM_ADMIN_PASSWORD ?? 'PilotDev123!',
}

const HR_PASSWORD = 'PlanLimitE2E123!'

type OrganizationSummary = {
  id: number
  name: string
}

/**
 * Story 6.4 — the Free seat cap refuses the user past the limit, and the browser says so.
 *
 * This used to hand-mint an HR token with `createHmac` and stub `/auth/me` and `/auth/refresh` so
 * the SPA would accept it. That stopped working and could not be repaired in kind: the signing
 * secret had been split into customer and platform secrets, `JwtTokenProvider` began validating
 * issuer and audience, and `JwtAuthenticationFilter.isActiveWorkforceUser` now confirms the
 * subject really belongs to the organization in the token — which a synthetic `sub: '1'` never
 * does for a freshly created tenant. Rather than chase those three checks with a better forgery,
 * the test now earns a real session the way the administrator does: the platform provisions the
 * Organization, the invitation email is read from the dev mail sink, the invitation is accepted
 * with a password, and the HR Admin signs in. Nothing about auth is stubbed any more.
 */
test.describe('Team member plan limit', { tag: [tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running with pilot seed data',
  )

  test('[P0] HR blocked adding over-limit Free user sees the limit and upgrade path, modal stays open', async ({
    page,
    request,
  }) => {
    const suffix = Date.now()
    const orgName = `Free Limit E2E ${suffix}`
    const hrEmail = `hr.limit.e2e.${suffix}@example.com`

    // Platform realm, not the customer one: Story 12.1 made /api/v1/auth/login answer 401 for an
    // operator.
    const { accessToken: platformToken } = await loginPlatformViaApi(
      request,
      platformAdminCredentials,
    )
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
    expect(org.id).toBeTruthy()

    // The platform provisioning path invites the initial administrator through
    // PasswordResetService.sendInvitation, so the mail carries a /reset-password link and the
    // password is set through /api/v1/auth/reset-password — not the /accept-invitation endpoint,
    // which belongs to the separate team-member invitation an HR Admin issues from Settings.
    const invitationToken = await initialPasswordTokenFor(request, hrEmail)
    await apiRequest({
      request,
      method: 'POST',
      path: '/api/v1/auth/reset-password',
      data: { token: invitationToken, password: HR_PASSWORD },
    })

    // America/New_York matches what PlatformAdminProvisioningService gives a newly provisioned
    // initial administrator, so signing in does not rewrite the row as a side effect.
    const hrCredentials = { email: hrEmail, password: HR_PASSWORD, timezone: 'America/New_York' }
    const { accessToken: hrToken } = await loginViaApi(request, hrCredentials)

    // A tenant is provisioned with no Workforce Groups — the HR Admin creates them — so the
    // members seeded below need one to belong to, and the modal's group select needs an option.
    const group = await apiRequest<{ id: number; name: string }>({
      request,
      method: 'POST',
      path: '/api/v1/workforce-groups',
      token: hrToken,
      data: { name: 'US' },
    })
    const groupId = group.id
    expect(groupId).toBeTruthy()

    // Four members plus the HR Admin puts this Organization exactly on the FREE(5) cap, so the
    // member added through the UI below is the one that must be refused. It seeded two while the
    // cap was FREE(3); Story 12.3 raised it to FREE(5) and updated the API test but not this
    // spec, so the fourth user became legal and the contracted refusal never fired.
    for (const index of [1, 2, 3, 4]) {
      await createMember(request, hrToken, groupId!, `user${index}.${suffix}@example.com`)
    }

    await loginViaUi(page, hrCredentials)
    await page.goto('/settings?category=people')
    await page.getByTestId('add-member-btn').click()
    await expect(page.getByText('Add Team Member')).toBeVisible()

    await page.getByLabel(/Full name/i).fill('Sixth User')
    await page.getByLabel(/Email/i).fill(`sixth.${suffix}@example.com`)
    await page.getByLabel(/Department/i).fill('Ops')
    // The support rail's "By workforce group" region is also labelled /Workforce Group/, so
    // getByLabel resolves to two elements; the <select> is the only combobox.
    await page.getByRole('combobox', { name: /Workforce Group/i }).selectOption({ index: 1 })
    await page.getByRole('button', { name: /Save/i }).click()

    // The refusal renders inside the modal as `plan-limit-banner` (role="alert", focused), not as
    // an app toast. TeamMemberModal surfaces plan-limit-reached as an upgrade prompt that stays
    // with the form; the toast this asserted no longer exists for this path. The message text is
    // still checked exactly, so a wrong limit or a missing organization name still fails.
    const banner = page.getByTestId('plan-limit-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText(`${orgName} is at the 5-user Free limit`)
    await expect(page.getByTestId('cta-upgrade-path')).toBeVisible()
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
