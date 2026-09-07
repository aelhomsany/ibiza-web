import type { APIRequestContext } from '@playwright/test'

import { test, expect } from '../support/fixtures'
import { loginViaApi, loginViaUi, navigateInApp } from '../support/helpers/auth'
import { apiRequest } from '../support/helpers/api-client'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

/**
 * Plan VUELTA / CANCEL-VAL-E2E-001 — the one journey the pyramid says belongs at this layer: an
 * employee whose leave has already started cannot get past the review modal without saying why,
 * and then sees what happened. Everything else about cancellation (who may cancel, what the
 * balance does, the 403s) is proved in the API tests, and the SPA-only rules in Vitest.
 *
 * Both tests provision their OWN leave request and act on it by id, for the reason spelled out in
 * approval-decision.spec.ts: consuming a seeded pending row silently breaks the six other specs
 * that read the curated demo fixture.
 */

// Omar is one of Alex's direct reports and the demo seed gives him no leave requests, so nothing
// another spec asserts changes when this one provisions and cancels leave for him.
const REQUESTER = { email: 'omar@company.com', password, timezone: 'Africa/Cairo' }
const MANAGER = { email: 'alex@company.com', password }
const ORGANIZATION_ADMIN = { email: 'jordan@company.com', password }

const iso = (value: Date) => value.toISOString().slice(0, 10)

/**
 * A two-working-day range starting on a Monday, `offsetDays` from today. Monday–Tuesday contains
 * working days under both the US (Sat/Sun) and Egypt (Fri/Sat) weekends; a negative offset walks
 * backwards so the range has already started.
 */
function mondayRange(offsetDays: number): { from: string; to: string } {
  const start = new Date()
  start.setUTCDate(start.getUTCDate() + offsetDays)
  const step = offsetDays < 0 ? -1 : 1
  while (start.getUTCDay() !== 1) {
    start.setUTCDate(start.getUTCDate() + step)
  }
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { from: iso(start), to: iso(end) }
}

async function createRequest(
  request: APIRequestContext,
  range: { from: string; to: string },
  note: string,
): Promise<number> {
  const { accessToken } = await loginViaApi(request, REQUESTER)

  const leaveTypes = await apiRequest<Array<{ id: number; name: string }>>({
    request,
    method: 'GET',
    path: '/api/v1/leave-types',
    token: accessToken,
  })
  const annual = leaveTypes.find((type) => type.name === 'Annual Leave')
  expect(annual, 'Annual Leave must exist in the seeded organization').toBeTruthy()

  const created = await apiRequest<{ id: number }>({
    request,
    method: 'POST',
    path: '/api/v1/leave-requests',
    token: accessToken,
    data: { leaveTypeId: annual!.id, dateFrom: range.from, dateTo: range.to, note },
  })
  return created.id
}

async function approveAsManager(request: APIRequestContext, requestId: number): Promise<void> {
  const { accessToken } = await loginViaApi(request, MANAGER)
  await apiRequest({
    request,
    method: 'POST',
    path: `/api/v1/leave-requests/${requestId}/approve`,
    token: accessToken,
  })
}

test.describe('Leave cancellation — Plan VUELTA', { tag: [tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when leaveo-api is running for pilot seed data',
  )

  test('[P1] Employee withdraws a pending request and it leaves their history as Cancelled', async ({
    page,
    request,
  }) => {
    const requestId = await createRequest(
      request,
      mondayRange(60),
      'E2E withdraw journey',
    )

    await loginViaUi(page, REQUESTER)
    await navigateInApp(page, '/my-leaves')

    await page.getByTestId(`my-leaves-cancel-button-${requestId}`).first().click()
    await expect(page.getByTestId('cancel-leave-modal')).toBeVisible()
    // Nothing was charged for a request nobody approved, so the copy promises nothing back and
    // no reason is asked for.
    await expect(page.getByTestId('cancel-reason-input')).toHaveCount(0)

    await page.getByTestId('cancel-confirm-btn').click()
    await expect(page.getByTestId('cancel-leave-modal')).toHaveCount(0)
    await expect(page.getByTestId('app-toast')).toBeVisible()
    await expect(
      page.getByTestId(`my-leaves-cancel-button-${requestId}`),
    ).toHaveCount(0)
  })

  test('[P1] Employee cannot ask to cancel a started leave without a reason, and sees the outcome', async ({
    page,
    request,
  }) => {
    // CANCEL-VAL-E2E-001. The started leave has to sit in the CURRENT balance year — a prior year
    // is refused outright (PRIOR_BALANCE_YEAR) and renders an explanation instead of a button.
    const range = mondayRange(-7)
    test.skip(
      new Date(range.from).getUTCFullYear() !== new Date().getUTCFullYear(),
      'No already-started weekday range exists in the current balance year during the first days of January',
    )

    const requestId = await createRequest(request, range, 'E2E retroactive cancellation')
    await approveAsManager(request, requestId)

    await loginViaUi(page, REQUESTER)
    await navigateInApp(page, '/my-leaves')

    await page.getByTestId(`my-leaves-cancel-button-${requestId}`).first().click()
    await expect(page.getByTestId('cancel-leave-modal')).toBeVisible()

    // The guard this layer exists to prove: the person cannot proceed, and the block is visible.
    const confirm = page.getByTestId('cancel-confirm-btn')
    await expect(confirm).toBeDisabled()
    await page.getByTestId('cancel-reason-input').fill('   ')
    await expect(confirm).toBeDisabled()

    await page.getByTestId('cancel-reason-input').fill('Trip was called off after it started.')
    await expect(confirm).toBeEnabled()
    await confirm.click()

    // The outcome: the request is now waiting on an admin, said so in the row, with no second
    // button to press.
    await expect(page.getByTestId('cancel-leave-modal')).toHaveCount(0)
    await expect(page.getByTestId('cancellation-pending-note').first()).toBeVisible()
    await expect(page.getByTestId(`my-leaves-cancel-button-${requestId}`)).toHaveCount(0)

    // And it is waiting on the Organization Admin specifically — the queue the manager never sees.
    await loginViaUi(page, ORGANIZATION_ADMIN)
    await navigateInApp(page, '/approvals')
    await expect(page.getByTestId(`cancellation-card-${requestId}`)).toBeVisible()
    await expect(page.getByTestId(`cancellation-consequence-${requestId}`)).toContainText(
      /working day/,
    )
  })
})
