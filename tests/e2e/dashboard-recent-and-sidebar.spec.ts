import { test, expect } from '../support/fixtures'
import { loginViaApi, loginViaUi, navigateInApp } from '../support/helpers/auth'
import { apiRequest } from '../support/helpers/api-client'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

/**
 * Story 3.2 — personal request history and the out-today feed.
 *
 * The filename still says "dashboard" because Story 3.2's implementation and ATDD
 * artifacts reference this path; the surfaces it covers moved on 2026-09-01 when the
 * Dashboard merged into My Leaves. Story 3.2's two requirements survived the merge and
 * split across the two screens, so this suite follows them there:
 *
 *   - recent requests  -> the Leave History card on /my-leaves
 *   - out-today feed   -> the Out Today strip on /calendar (the new landing page),
 *                         with an aggregate coverage count on the My Leaves rail
 *
 * `balance-grid`, `recent-requests-card`, `out-today-sidebar` and `out-today-row-*` no
 * longer exist in the app; asserting them here would have failed against a correct build.
 */
test.describe('Request history and out-today — Story 3.2', { tag: [tags.regression, tags.api] }, () => {
  test.skip(process.env.E2E_API_AVAILABLE !== 'true', 'Set E2E_API_AVAILABLE=true to run against live API + pilot seed')

  test('[P1] Employee sees balances, history and the coverage rail after login', async ({
    page,
  }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    await navigateInApp(page, '/my-leaves')

    await expect(page.getByTestId('my-leaves-balance-grid')).toBeVisible()
    await expect(page.getByTestId('my-leaves-history')).toBeVisible()
    await expect(page.getByTestId('my-leaves-support-rail')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Leave History' })).toBeVisible()
    // dashboard:coverage.title is "Team coverage"; the rail uppercases it in CSS only.
    await expect(page.getByText('Team coverage')).toBeVisible()
  })

  test('[P1] Pending row shows Waiting for approval hint', async ({ page }) => {
    await loginViaUi(page, { email: 'sarah@company.com', password })
    await navigateInApp(page, '/my-leaves')

    const pendingRow = page.getByTestId('my-leaves-history').locator('tr.row-pending').first()
    await expect(pendingRow).toBeVisible()
    await expect(pendingRow.getByText('Waiting for approval')).toBeVisible()
    await expect(pendingRow.getByText('Pending')).toBeVisible()
  })

  test('[P1] Out today matches the server and badges every teammate', async ({ page, request }) => {
    // This used to assert a WFH/Off badge unconditionally, which made it fail on any weekend:
    // "out today" is legitimately empty on a non-working day, and the seeder anchors its
    // WFH-today row to a working day, so on a Saturday the row sits on the preceding Thursday.
    // The test was therefore red two days in seven for a correct product. It now asserts the
    // real contract — the strip renders exactly what /api/v1/dashboard/out-today returns, and
    // every row it renders carries a presence badge — which holds on every day of the week and
    // is stricter than the old "at least one badge exists" check.
    //
    // The feed moved from the dashboard sidebar to the Team Calendar's Out Today strip when the
    // calendar became the landing page; the endpoint and its contract are unchanged.
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
    await navigateInApp(page, '/calendar')

    const strip = page.getByTestId('calendar-out-today')
    await expect(strip).toBeVisible()

    if (outToday.length === 0) {
      await expect(strip.getByTestId('calendar-out-today-empty')).toBeVisible()
      await expect(strip.getByText(/^(WFH|Off)$/)).toHaveCount(0)
      return
    }

    for (const row of outToday) {
      const rendered = strip.getByTestId(`calendar-out-today-${row.userId}`)
      await expect(rendered).toBeVisible()
      await expect(rendered.getByText(/^(WFH|Off)$/)).toBeVisible()
    }
    await expect(strip.getByText(/^(WFH|Off)$/)).toHaveCount(outToday.length)
  })

  test('[P1] My Leaves coverage rail counts the same out-today feed', async ({ page, request }) => {
    // The rail shows aggregate counts rather than people. Splitting one feed across two
    // screens is only safe if both read the same numbers, so this pins the rail's Off/WFH
    // tallies to the server response the strip above renders person-by-person.
    const { accessToken } = await loginViaApi(request, {
      email: 'sarah@company.com',
      password,
      timezone: 'Africa/Cairo',
    })
    const outToday = await apiRequest<Array<{ userId: number; presence: 'WFH' | 'OFF' }>>({
      request,
      method: 'GET',
      path: '/api/v1/dashboard/out-today',
      token: accessToken,
    })
    const offCount = outToday.filter((row) => row.presence === 'OFF').length
    const wfhCount = outToday.filter((row) => row.presence === 'WFH').length

    await loginViaUi(page, { email: 'sarah@company.com', password })
    await navigateInApp(page, '/my-leaves')

    const rail = page.getByTestId('my-leaves-support-rail')
    await expect(rail).toBeVisible()
    await expect(rail.getByTestId('my-leaves-rail-off-today')).toHaveText(String(offCount))
    await expect(rail.getByTestId('my-leaves-rail-wfh-today')).toHaveText(String(wfhCount))
  })
})
