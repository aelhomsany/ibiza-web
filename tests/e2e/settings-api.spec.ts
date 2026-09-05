import { test, expect } from '../support/fixtures'
import { tags } from '../support/tags'

const apiUrl = process.env.API_URL ?? process.env.VITE_API_URL ?? 'http://localhost:8080'
const hrEmail = process.env.E2E_HR_EMAIL ?? 'jordan@company.com'
const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

test.describe('Settings API — workforce groups and holidays', { tag: [tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when leaveo-api is running for settings API checks',
  )

  test('[P1-004] US and Egypt groups expose different weekend day configurations', async ({ request }) => {
    const loginResponse = await request.post(`${apiUrl}/api/v1/auth/login`, {
      data: {
        email: hrEmail,
        password,
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

    const groupsResponse = await request.get(`${apiUrl}/api/v1/workforce-groups`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(groupsResponse.ok()).toBeTruthy()

    const groups = await groupsResponse.json()
    const us = groups.find((group: { name: string }) => group.name === 'US')
    const egypt = groups.find((group: { name: string }) => group.name === 'Egypt')

    expect(us.weekendDays).toEqual(expect.arrayContaining(['SATURDAY', 'SUNDAY']))
    expect(egypt.weekendDays).toEqual(expect.arrayContaining(['FRIDAY', 'SATURDAY']))
    expect(us.weekendDays).not.toEqual(egypt.weekendDays)
  })

  test('[P1-005] US group lists seeded public holidays', async ({ request }) => {
    const loginResponse = await request.post(`${apiUrl}/api/v1/auth/login`, {
      data: {
        email: hrEmail,
        password,
        timezone: 'Africa/Cairo',
      },
    })
    expect(loginResponse.ok()).toBeTruthy()
    const { accessToken } = await loginResponse.json()

    const groupsResponse = await request.get(`${apiUrl}/api/v1/workforce-groups`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const groups = await groupsResponse.json()
    const usGroupId = groups.find((group: { name: string }) => group.name === 'US').id

    const holidaysResponse = await request.get(
      `${apiUrl}/api/v1/public-holidays?workforceGroupId=${usGroupId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    expect(holidaysResponse.ok()).toBeTruthy()

    const holidays = await holidaysResponse.json()
    const holidayNames = holidays.map((holiday: { name: string }) => holiday.name)
    expect(holidayNames).toEqual(expect.arrayContaining(['Juneteenth', 'Independence Day']))
  })
})
