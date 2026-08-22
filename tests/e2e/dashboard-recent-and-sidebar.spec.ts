import { test, expect } from '../support/fixtures'
import { loginViaApi, loginViaUi, navigateInApp } from '../support/helpers/auth'
import { apiRequest } from '../support/helpers/api-client'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

test.describe('Dashboard recent requests and sidebar — Story 3.2', { tag: [tags.regression, tags.api] }, () => {
  test.skip(process.env.E2E_API_AVAILABLE !== 'true', 'Set E2E_API_AVAILABLE=true to run against live API + pilot seed')

  test('[P1] Employee sees recent requests table and out-today sidebar after login', async ({
    page,
  }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    await navigateInApp(page, '/')

    await expect(page.getByTestId('balance-grid')).toBeVisible()
    await expect(page.getByTestId('recent-requests-card')).toBeVisible()
    await expect(page.getByTestId('out-today-sidebar')).toBeVisible()
    await expect(page.getByText('My Recent Requests')).toBeVisible()
    await expect(page.getByText('Out Today')).toBeVisible()
  })

  test('[P1] Pending row shows Waiting for approval hint', async ({ page }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    await navigateInApp(page, '/')

    const pendingRow = page.getByTestId('recent-requests-card').locator('tr.row-pending').first()
    await expect(pendingRow).toBeVisible()
    await expect(pendingRow.getByText('Waiting for approval')).toBeVisible()
    await expect(pendingRow.getByText('Pending')).toBeVisible()
  })

  test('[P1] Out today matches the server and badges every teammate', async ({ page, request }) => {
    // This used to assert a WFH/Off badge unconditionally, which made it fail on any weekend:
    // "out today" is legitimately empty on a non-working day, and the seeder anchors its
    // WFH-today row to a working day, so on a Saturday the row sits on the preceding Thursday.
    // The test was therefore red two days in seven for a correct product. It now asserts the
    // real contract — the sidebar renders exactly what /api/v1/dashboard/out-today returns, and
    // every row it renders carries a presence badge — which holds on every day of the week and
    // is stricter than the old "at least one badge exists" check.
    const { accessToken } = await loginViaApi(request, {
      email: 'sarah@company.com',
      password,
      timezone: 'Africa/Cairo',
    })
    const outToday = await apiRequest<Array<{ userId: number }>>({
      request,
      method: 'GET',
      path: '/api/v1/dashboard/out-today',
      token: accessToken,
    })

    await loginViaUi(page, { email: 'sarah@company.com', password })
    await navigateInApp(page, '/')

    const sidebar = page.getByTestId('out-today-sidebar')
    await expect(sidebar).toBeVisible()

    if (outToday.length === 0) {
      await expect(sidebar.getByText(/^(WFH|Off)$/)).toHaveCount(0)
      return
    }

    for (const row of outToday) {
      const rendered = sidebar.getByTestId(`out-today-row-${row.userId}`)
      await expect(rendered).toBeVisible()
      await expect(rendered.getByText(/^(WFH|Off)$/)).toBeVisible()
    }
    await expect(sidebar.getByText(/^(WFH|Off)$/)).toHaveCount(outToday.length)
  })
})
