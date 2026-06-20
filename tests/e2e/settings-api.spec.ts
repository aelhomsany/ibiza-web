import { test, expect } from '../support/fixtures'

const apiUrl = process.env.API_URL ?? process.env.VITE_API_URL ?? 'http://localhost:8080'
const hrEmail = process.env.E2E_HR_EMAIL ?? 'jordan@company.com'
const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

test.describe('Settings API — workforce groups and holidays', () => {
  test.skip(
    !process.env.E2E_API_AVAILABLE,
    'Set E2E_API_AVAILABLE=true when ibiza-api is running for settings API checks',
  )

  test('[P1-004] US and Egypt groups expose different weekend day configurations', async ({ request }) => {
    const loginResponse = await request.post(`${apiUrl}/api/v1/auth/login`, {
      data: {
        email: hrEmail,
        password,
        timezone: 'America/New_York',
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
        timezone: 'America/New_York',
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
