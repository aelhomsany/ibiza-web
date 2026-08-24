import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../api/client'
import type { ReportExportResponse, ReportQueryResponse } from '../../api/generated/types'
import { ToastProvider } from '../../components/ui/ToastProvider'
import i18n from '../../i18n/config'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { ReportCenterPage } from './ReportCenterPage'

function balanceResponse(
  overrides: Partial<ReportQueryResponse> = {},
): ReportQueryResponse {
  return {
    viewKey: 'BALANCE_SNAPSHOT:v1',
    definitionKey: 'BALANCE_SNAPSHOT',
    schemaVersion: 1,
    appliedView: {
      timezone: 'America/New_York',
      effectiveDate: '2026-08-24',
      includeInactiveUsers: false,
      sort: 'userName',
      direction: 'ASC',
    },
    displayTimezone: 'America/New_York',
    asOf: '2026-08-24T12:00:00Z',
    ordering: [
      { field: 'userName', direction: 'ASC' },
      { field: 'leaveTypeDisplayOrder', direction: 'ASC' },
    ],
    summary: {
      summaryType: 'BALANCE_SNAPSHOT',
      rowCount: 1,
      userCount: 1,
      leaveTypeCount: 1,
      totalAllocation: 25,
      // Deliberately inconsistent with the single row's approvedUsage of 4. This is the
      // mechanism of the "no client aggregation" assertion below: the page must print
      // the server's whole-result total verbatim, so a page that summed the rows would
      // render 4 here and fail. Do not "correct" it to 4 — that silently voids the test.
      totalApprovedUsage: 77,
      totalAdjustments: 0,
      totalRemaining: 21,
      exceptionCount: 0,
      uncappedRowCount: 0,
      totalsByPresence: { OFF: { rowCount: 1, allocation: 25, approvedUsage: 4, remaining: 21 } },
    },
    rows: [
      {
        rowType: 'BALANCE_SNAPSHOT',
        userId: 5,
        userName: 'Jordan Lee',
        userStatus: 'ACTIVE',
        workforceGroupId: 8,
        workforceGroupName: 'Cairo',
        leaveTypeId: 3,
        leaveTypeName: 'Annual leave',
        leaveTypeDisplayOrder: 1,
        presence: 'OFF',
        capped: true,
        allocation: 25,
        approvedUsage: 4,
        adjustments: 0,
        remaining: 21,
        exceptionCodes: [],
      },
    ],
    page: 0,
    size: 50,
    total: 1,
    provenance: {
      basis: 'CURRENT_BALANCE_ACCOUNT',
      incomplete: false,
      excludedCounts: {},
      uncertainty: undefined,
      adjustmentsBasis: 'SCHEMA_1_EXPLICIT_ZERO',
    },
    ...overrides,
  } as ReportQueryResponse
}

/** One realistic response per definition, keyed by its own discriminators. */
const definitionFixtures: Record<
  string,
  { response: ReportQueryResponse; header: string; cell: string }
> = {
  LEAVE_USAGE: {
    header: 'Charged days',
    cell: '12',
    response: {
      definitionKey: 'LEAVE_USAGE',
      schemaVersion: 1,
      appliedView: { timezone: 'America/New_York', from: '2026-08-01', to: '2026-08-24' },
      displayTimezone: 'America/New_York',
      asOf: '2026-08-24T12:00:00Z',
      ordering: [{ field: 'chargedDayCount', direction: 'DESC' }],
      summary: {
        summaryType: 'LEAVE_USAGE',
        rowCount: 1,
        requestCount: 3,
        chargedDayCount: 12,
        excludedReconstructedRequestCount: 0,
        excludedUnknownRequestCount: 0,
        requestCountsByPresence: { OFF: 3 },
        chargedDayCountsByPresence: { OFF: 12 },
      },
      rows: [
        {
          rowType: 'LEAVE_USAGE',
          userId: 5,
          userName: 'Jordan Lee',
          workforceGroupName: 'Cairo',
          leaveTypeName: 'Annual leave',
          presence: 'OFF',
          membershipBasis: 'CURRENT',
          requestCount: 3,
          chargedDayCount: 12,
        },
      ],
      page: 0,
      size: 50,
      total: 1,
      provenance: {
        basis: 'SUBMISSION_CAPTURED_CHARGED_DATES',
        incomplete: false,
        excludedCounts: {},
      },
    } as ReportQueryResponse,
  },
  REQUEST_DETAIL: {
    header: 'Decided at',
    cell: 'Approved',
    response: {
      definitionKey: 'REQUEST_DETAIL',
      schemaVersion: 1,
      appliedView: { timezone: 'America/New_York', from: '2026-08-01', to: '2026-08-24' },
      displayTimezone: 'America/New_York',
      asOf: '2026-08-24T12:00:00Z',
      ordering: [{ field: 'dateFrom', direction: 'DESC' }],
      summary: {
        summaryType: 'REQUEST_DETAIL',
        rowCount: 1,
        storedDayCount: 4,
        statusCounts: { APPROVED: 1 },
        storedDayCountsByStatus: { APPROVED: 4 },
      },
      rows: [
        {
          rowType: 'REQUEST_DETAIL',
          requestId: 77,
          userName: 'Jordan Lee',
          workforceGroupName: 'Cairo',
          leaveTypeName: 'Annual leave',
          dateFrom: '2026-08-10',
          dateTo: '2026-08-13',
          storedDays: 4,
          status: 'APPROVED',
          submittedAt: '2026-08-01T09:00:00Z',
          decidedAt: '2026-08-02T09:00:00Z',
          currentApprovalStageCode: 'COMPLETED',
        },
      ],
      page: 0,
      size: 50,
      total: 1,
      provenance: {
        basis: 'REQUEST_INTERVAL_OVERLAP_CURRENT_MEMBERSHIP',
        incomplete: false,
        excludedCounts: {},
      },
    } as ReportQueryResponse,
  },
  EXCEPTION: {
    header: 'Facts',
    cell: 'Negative remaining balance',
    response: {
      definitionKey: 'EXCEPTION',
      schemaVersion: 1,
      appliedView: { timezone: 'America/New_York' },
      displayTimezone: 'America/New_York',
      asOf: '2026-08-24T12:00:00Z',
      ordering: [{ field: 'severity', direction: 'ASC' }],
      summary: {
        summaryType: 'EXCEPTION',
        rowCount: 1,
        codeCounts: { NEGATIVE_REMAINING: 1 },
        severityCounts: { HIGH: 1 },
      },
      rows: [
        {
          rowType: 'EXCEPTION',
          code: 'NEGATIVE_REMAINING',
          subjectType: 'USER_LEAVE_TYPE',
          subjectId: 5,
          subjectLabel: 'Jordan Lee — Annual leave',
          severity: 'HIGH',
          detectedAsOf: '2026-08-24T12:00:00Z',
          // Nested objects: a single String() pass renders [object Object].
          facts: { balance: { remaining: -2, allocation: 25 } },
        },
      ],
      page: 0,
      size: 50,
      total: 1,
      provenance: {
        basis: 'CURRENT_TYPED_EXCEPTION_FACTS',
        incomplete: false,
        excludedCounts: {},
      },
    } as ReportQueryResponse,
  },
  PENDING_AGING: {
    header: 'Activated at',
    cell: 'Current pending step activation',
    response: {
      definitionKey: 'PENDING_AGING',
      schemaVersion: 1,
      appliedView: { timezone: 'America/New_York' },
      displayTimezone: 'America/New_York',
      asOf: '2026-08-24T12:00:00Z',
      ordering: [{ field: 'ageDays', direction: 'DESC' }],
      summary: {
        summaryType: 'PENDING_AGING',
        rowCount: 1,
        oldestAgeDays: 9,
        bucketCounts: { '7_PLUS': 1 },
        provenanceCounts: { CURRENT_PENDING_STEP_ACTIVATION: 1 },
      },
      rows: [
        {
          rowType: 'PENDING_AGING',
          requestId: 91,
          userName: 'Noor Ali',
          workforceGroupName: 'Cairo',
          leaveTypeName: 'Annual leave',
          dateFrom: '2026-09-01',
          dateTo: '2026-09-03',
          currentApprovalStageCode: 'LEVEL_1',
          submittedAt: '2026-08-15T09:00:00Z',
          activatedAt: '2026-08-15T10:00:00Z',
          ageDays: 9,
          activationProvenance: 'CURRENT_PENDING_STEP_ACTIVATION',
          bucket: '7_PLUS',
        },
      ],
      page: 0,
      size: 50,
      total: 1,
      provenance: {
        basis: 'CURRENT_PENDING_STEP_ACTIVATION',
        incomplete: true,
        excludedCounts: { PENDING_REQUESTS_WITHOUT_ACTIVATED_STEP: 2 },
      },
    } as ReportQueryResponse,
  },
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <AuthTestProvider value={createMockAuthForRole('HR_ADMIN')}>
            <ReportCenterPage />
          </AuthTestProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('ReportCenterPage', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      { id: 8, name: 'Cairo', weekendDays: ['FRIDAY', 'SATURDAY'] },
    ])
    vi.spyOn(apiClient, 'getLeaveTypes').mockResolvedValue([
      { id: 3, name: 'Annual leave', icon: 'palm', color: '#167d78', displayOrder: 1 },
    ])
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    cleanup()
    if (i18n.language !== 'en') {
      await i18n.changeLanguage('en')
    }
  })

  it('[P0] renders authoritative summary, applied scope, provenance, and rows without client aggregation', async () => {
    vi.spyOn(apiClient, 'queryReport').mockResolvedValue(balanceResponse())

    renderPage()

    expect(await screen.findByTestId('report-center-page')).toHaveClass('page-wide')
    const definitionSelect = screen.getByLabelText('Report definition')
    expect(within(definitionSelect).getAllByRole('option').map((option) => option.getAttribute('value')))
      .toEqual([
        'BALANCE_SNAPSHOT',
        'LEAVE_USAGE',
        'REQUEST_DETAIL',
        'EXCEPTION',
        'PENDING_AGING',
      ])
    // 77 is the server's whole-result total; the single row shows 4. Summing rows fails.
    expect(await screen.findByTestId('report-summary-totalApprovedUsage')).toHaveTextContent('77')
    const row = screen.getByTestId('report-row-0')
    expect(within(row).getByText('Jordan Lee')).toBeInTheDocument()
    expect(within(row).getByText('4')).toBeInTheDocument()
    const applied = screen.getByTestId('report-applied-view')
    // Dates render localized, not as the raw ISO the server sent.
    expect(applied).toHaveTextContent('Aug 24, 2026')
    expect(applied).toHaveTextContent('America/New_York')
    expect(applied).toHaveTextContent('Balance Snapshot')
    expect(screen.getByTestId('report-results-region')).toHaveAccessibleName(
      'Balance Snapshot results',
    )
  })

  it('[P0] renders the server ordering including its tie-breakers', async () => {
    vi.spyOn(apiClient, 'queryReport').mockResolvedValue(balanceResponse())

    renderPage()

    const ordering = await screen.findByTestId('report-ordering')
    expect(ordering).toHaveTextContent('User name')
    expect(ordering).toHaveTextContent('Ascending')
    // The second entry is a deterministic tie-breaker the user cannot pick.
    expect(ordering).toHaveTextContent('leaveTypeDisplayOrder')
  })

  it('[P0] translates server enum codes rather than printing them raw', async () => {
    vi.spyOn(apiClient, 'queryReport').mockResolvedValue(balanceResponse())

    renderPage()

    const provenance = await screen.findByTestId('report-provenance')
    expect(provenance).toHaveTextContent('Current balance account')
    expect(provenance).toHaveTextContent('Explicit zero (schema 1)')
    expect(provenance).not.toHaveTextContent('CURRENT_BALANCE_ACCOUNT')
    expect(screen.getByTestId('report-row-0')).toHaveTextContent('Away')
    // Nested summary maps must not collapse to [object Object].
    const byPresence = screen.getByTestId('report-summary-totalsByPresence')
    expect(byPresence).toHaveTextContent('Away')
    expect(byPresence).not.toHaveTextContent('[object Object]')
  })

  it('[P0] stamps the capture time against the applied timezone, not the browser zone', async () => {
    vi.spyOn(apiClient, 'queryReport').mockResolvedValue(balanceResponse())

    renderPage()

    const asOf = await screen.findByTestId('report-as-of')
    expect(within(asOf).getByRole('time')).toHaveAttribute(
      'datetime',
      '2026-08-24T12:00:00Z',
    )
    expect(asOf).toHaveTextContent('America/New_York')
    // 12:00Z is 08:00 in New York; a browser-zone render would print a different hour.
    expect(asOf).toHaveTextContent('8:00')
  })

  it('[P0] removes unsupported draft filters when the report definition changes', async () => {
    const querySpy = vi.spyOn(apiClient, 'queryReport').mockResolvedValue(balanceResponse())
    const user = userEvent.setup()
    renderPage()

    await screen.findByTestId('report-row-0')
    await user.selectOptions(screen.getByLabelText('Report definition'), 'REQUEST_DETAIL')
    await user.type(screen.getByLabelText('From'), '2026-08-01')
    await user.type(screen.getByLabelText('To'), '2026-08-24')
    await user.selectOptions(screen.getByLabelText('Status'), 'APPROVED')
    await user.selectOptions(screen.getByLabelText('Report definition'), 'PENDING_AGING')
    await user.click(screen.getByRole('button', { name: 'Apply Filters' }))

    await waitFor(() => expect(querySpy).toHaveBeenCalledTimes(2))
    const [definition, request] = querySpy.mock.calls.at(-1)!
    expect(definition).toBe('PENDING_AGING')
    expect(request).toMatchObject({
      schemaVersion: 1,
      timezone: 'America/New_York',
      sort: 'ageDays',
      direction: 'DESC',
      page: 0,
    })
    expect(request).not.toHaveProperty('from')
    expect(request).not.toHaveProperty('to')
    expect(request).not.toHaveProperty('status')
    expect(request).not.toHaveProperty('includeInactiveUsers')
    // Page size is server configuration; sending a fixed 50 can exceed a deployment max.
    expect(request).not.toHaveProperty('size')
  })

  it('[P0] blocks Apply and explains the gap when a required date range is incomplete', async () => {
    const querySpy = vi.spyOn(apiClient, 'queryReport').mockResolvedValue(balanceResponse())
    const user = userEvent.setup()
    renderPage()

    await screen.findByTestId('report-row-0')
    await user.selectOptions(screen.getByLabelText('Report definition'), 'LEAVE_USAGE')
    await user.type(screen.getByLabelText('From'), '2026-08-01')
    await user.click(screen.getByRole('button', { name: 'Apply Filters' }))

    expect(
      await screen.findByText('Choose both From and To dates for this report.'),
    ).toBeInTheDocument()
    // Only the bootstrap query ran; the incomplete range never reached the server.
    expect(querySpy).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('From')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('From')).toHaveAttribute(
      'aria-describedby',
      'report-filter-error',
    )
  })

  it('[P0] rejects an inverted date range before it costs a round trip', async () => {
    const querySpy = vi.spyOn(apiClient, 'queryReport').mockResolvedValue(balanceResponse())
    const user = userEvent.setup()
    renderPage()

    await screen.findByTestId('report-row-0')
    await user.selectOptions(screen.getByLabelText('Report definition'), 'LEAVE_USAGE')
    await user.type(screen.getByLabelText('From'), '2026-08-24')
    await user.type(screen.getByLabelText('To'), '2026-08-01')
    await user.click(screen.getByRole('button', { name: 'Apply Filters' }))

    expect(
      await screen.findByText('The From date must be on or before the To date.'),
    ).toBeInTheDocument()
    expect(querySpy).toHaveBeenCalledTimes(1)
  })

  it('[P0] clears and explains the group filters the groupless exception code forbids', async () => {
    const querySpy = vi.spyOn(apiClient, 'queryReport').mockResolvedValue(balanceResponse())
    const user = userEvent.setup()
    renderPage()

    await screen.findByTestId('report-row-0')
    await user.selectOptions(screen.getByLabelText('Report definition'), 'EXCEPTION')
    await user.selectOptions(screen.getByLabelText('Workforce group'), '8')
    await user.selectOptions(
      screen.getByLabelText('Exception type'),
      'USER_WITHOUT_WORKFORCE_GROUP',
    )

    const groupSelect = screen.getByLabelText('Workforce group')
    expect(groupSelect).toBeDisabled()
    expect(groupSelect).toHaveValue('')
    expect(screen.getByLabelText('Leave type')).toBeDisabled()
    // A disabled control with no explanation is the UI form of a silently dropped filter.
    expect(groupSelect).toHaveAccessibleDescription(/do not apply to users without/i)

    await user.click(screen.getByRole('button', { name: 'Apply Filters' }))
    await waitFor(() => expect(querySpy).toHaveBeenCalledTimes(2))
    const request = querySpy.mock.calls.at(-1)?.[1]
    expect(request).not.toHaveProperty('workforceGroupId')
    expect(request).not.toHaveProperty('leaveTypeId')
    expect(request).toMatchObject({ exceptionCode: 'USER_WITHOUT_WORKFORCE_GROUP' })
  })

  it.each(Object.entries(definitionFixtures))(
    '[P0] renders %s with its own columns, labels, and values',
    async (definitionKey, fixture) => {
      const querySpy = vi
        .spyOn(apiClient, 'queryReport')
        .mockResolvedValueOnce(balanceResponse())
        .mockResolvedValue(fixture.response)
      const user = userEvent.setup()
      renderPage()

      await screen.findByTestId('report-row-0')
      await user.selectOptions(screen.getByLabelText('Report definition'), definitionKey)
      if (screen.queryByLabelText('From')) {
        await user.type(screen.getByLabelText('From'), '2026-08-01')
        await user.type(screen.getByLabelText('To'), '2026-08-24')
      }
      await user.click(screen.getByRole('button', { name: 'Apply Filters' }))

      await waitFor(() => expect(querySpy).toHaveBeenCalledTimes(2))
      expect(await screen.findByRole('columnheader', { name: fixture.header }))
        .toBeInTheDocument()
      const row = await screen.findByTestId('report-row-0')
      expect(row).toHaveTextContent(fixture.cell)
      // A blank cell still satisfies toBeVisible(), so assert nothing rendered empty.
      within(row)
        .getAllByRole('cell')
        .forEach((cell) => {
          expect(cell.textContent?.trim()).not.toBe('')
          expect(cell).not.toHaveTextContent('[object Object]')
        })
      // Every column header resolves to real copy; a missing key renders as ''.
      screen.getAllByRole('columnheader').forEach((header) => {
        expect(header.textContent?.trim()).not.toBe('')
      })
    },
  )

  it('[P0] keeps the applied report when the interface language changes', async () => {
    const querySpy = vi
      .spyOn(apiClient, 'queryReport')
      .mockResolvedValueOnce(balanceResponse())
      .mockResolvedValue(definitionFixtures.PENDING_AGING.response)
    const user = userEvent.setup()
    renderPage()

    await screen.findByTestId('report-row-0')
    await user.selectOptions(screen.getByLabelText('Report definition'), 'PENDING_AGING')
    await user.click(screen.getByRole('button', { name: 'Apply Filters' }))
    await waitFor(() => expect(querySpy).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Noor Ali')).toBeInTheDocument()

    await act(async () => {
      await i18n.changeLanguage('ar')
    })

    // No third query, and the Pending Aging result is still the one on screen — a new
    // `t` identity must not re-run the bootstrap effect and swap in Balance Snapshot.
    expect(querySpy).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Noor Ali')).toBeInTheDocument()
    expect(screen.getByTestId('report-applied-view')).toHaveTextContent('عمر الطلبات المعلقة')
  })

  it('[P0] clears stale evidence after a denied query while preserving the draft filters', async () => {
    const querySpy = vi
      .spyOn(apiClient, 'queryReport')
      .mockResolvedValueOnce(balanceResponse())
      .mockRejectedValue(
        new apiClient.ApiError(403, {
          status: 403,
          title: 'Forbidden',
          detail: 'Advanced reporting is not available.',
        }),
      )
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Jordan Lee')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Workforce group'), '8')
    await user.click(screen.getByRole('button', { name: 'Apply Filters' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Advanced reporting is not available.')
    expect(screen.queryByText('Jordan Lee')).not.toBeInTheDocument()
    expect(screen.queryByTestId('report-summary-totalApprovedUsage')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Workforce group')).toHaveValue('8')
    expect(querySpy).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(querySpy).toHaveBeenCalledTimes(3))
    expect(querySpy.mock.calls.at(-1)?.[1]).toMatchObject({ workforceGroupId: 8, page: 0 })
  })

  it('[P1] falls back to a localized message when the failure carries no problem detail', async () => {
    vi.spyOn(apiClient, 'queryReport').mockRejectedValue(new TypeError('Failed to fetch'))

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't load this report. Review the filters and try again.",
    )
  })

  it('[P1] says so when the filter option lists could not be loaded', async () => {
    vi.spyOn(apiClient, 'queryReport').mockResolvedValue(balanceResponse())
    vi.spyOn(apiClient, 'getWorkforceGroups').mockRejectedValue(new Error('boom'))

    renderPage()

    expect(await screen.findByTestId('report-filter-options-error')).toHaveTextContent(
      /workforce group and leave type options/i,
    )
  })

  it('[P1] explains an empty incomplete result using server provenance', async () => {
    vi.spyOn(apiClient, 'queryReport').mockResolvedValue(
      balanceResponse({
        summary: {
          summaryType: 'BALANCE_SNAPSHOT',
          rowCount: 0,
          userCount: 0,
          leaveTypeCount: 0,
          totalAllocation: 0,
          totalApprovedUsage: 0,
          totalAdjustments: 0,
          totalRemaining: 0,
          exceptionCount: 0,
          uncappedRowCount: 0,
          totalsByPresence: {},
        },
        rows: [],
        total: 0,
        provenance: {
          basis: 'CURRENT_BALANCE_ACCOUNT',
          incomplete: true,
          excludedCounts: { LEGACY_RECONSTRUCTED_REQUESTS: 3 },
          uncertainty: 'Requests without submission-captured charged dates are excluded',
          adjustmentsBasis: 'SCHEMA_1_EXPLICIT_ZERO',
        },
      }),
    )

    renderPage()

    expect(await screen.findByTestId('report-empty')).toBeInTheDocument()
    // An empty page over incomplete evidence is not a confirmed zero.
    expect(screen.getByTestId('report-empty-incomplete')).toHaveTextContent(
      /not a confirmed zero/i,
    )
    const provenance = screen.getByTestId('report-provenance')
    expect(provenance).toHaveTextContent('Incomplete')
    expect(provenance).toHaveTextContent('Reconstructed legacy requests')
    expect(provenance).toHaveTextContent('3')
    // An empty map must read as "Not available", not as a blank tile.
    expect(screen.getByTestId('report-summary-totalsByPresence')).toHaveTextContent(
      'Not available',
    )
  })

  it('[P1] pages forward and back, announcing the applied page and keeping focus', async () => {
    const querySpy = vi.spyOn(apiClient, 'queryReport').mockImplementation((_definition, request) =>
      Promise.resolve(
        balanceResponse({
          page: request.page,
          total: 51,
          rows: [
            {
              ...(balanceResponse().rows[0]),
              userId: request.page === 1 ? 9 : 5,
              userName: request.page === 1 ? 'Noor Ali' : 'Jordan Lee',
            },
          ],
        }),
      ),
    )
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Jordan Lee')).toBeInTheDocument()
    const previous = screen.getByRole('button', { name: 'Previous Page' })
    expect(previous).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next Page' }))

    expect(await screen.findByText('Noor Ali')).toBeInTheDocument()
    expect(screen.getByTestId('report-pagination-status')).toHaveTextContent('Page 2')
    expect(querySpy.mock.calls.at(-1)?.[1]).toMatchObject({ page: 1 })
    // The buttons unmount while the page loads. Page 2 of 2 disables Next, so focus
    // lands on the enabled sibling rather than falling to <body>.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Previous Page' })).toHaveFocus(),
    )

    await user.click(screen.getByRole('button', { name: 'Previous Page' }))
    expect(await screen.findByText('Jordan Lee')).toBeInTheDocument()
    expect(screen.getByTestId('report-pagination-status')).toHaveTextContent('Page 1')
    expect(screen.getByRole('button', { name: 'Previous Page' })).toBeDisabled()
  })

  it('[P1] never offers a page beyond the total, even if the server reports no page size', async () => {
    vi.spyOn(apiClient, 'queryReport').mockResolvedValue(
      balanceResponse({ size: 0, total: 51 }),
    )

    renderPage()

    await screen.findByTestId('report-row-0')
    // size 0 must not make Math.ceil(total / size) infinite.
    expect(screen.getByRole('button', { name: 'Next Page' })).toBeDisabled()
    expect(screen.getByTestId('report-pagination-status')).toHaveTextContent('Page 1 of 1')
  })

  it('[P0] creates a durable export from the applied view and announces its queued state', async () => {
    vi.spyOn(apiClient, 'queryReport').mockResolvedValue(balanceResponse())
    const queuedExport: ReportExportResponse = {
      id: 'export-1',
      definitionKey: 'BALANCE_SNAPSHOT',
      schemaVersion: 1,
      format: 'XLSX',
      status: 'QUEUED',
      viewKey: 'BALANCE_SNAPSHOT:v1',
      displayTimezone: 'America/New_York',
      asOf: '2026-08-24T12:00:00Z',
      appliedView: balanceResponse().appliedView,
      ordering: balanceResponse().ordering,
      summary: balanceResponse().summary,
      provenance: balanceResponse().provenance,
      rowCount: 1,
      createdAt: '2026-08-24T12:01:00Z',
      expiresAt: '2026-08-31T12:01:00Z',
      fileName: 'balance-snapshot.xlsx',
      downloadAvailable: false,
      canRetry: false,
    }
    const createSpy = vi
      .spyOn(apiClient, 'createReportExport')
      .mockResolvedValue(queuedExport)
    vi.spyOn(apiClient, 'getReportExport').mockResolvedValue(queuedExport)
    const user = userEvent.setup()

    renderPage()

    await screen.findByTestId('report-row-0')
    await user.selectOptions(screen.getByLabelText('Export format'), 'XLSX')
    await user.click(screen.getByRole('button', { name: 'Create Export' }))

    const status = await screen.findByTestId('report-export-status')
    expect(status).toHaveTextContent('Queued')
    expect(status).toHaveTextContent('XLSX')
    expect(createSpy).toHaveBeenCalledWith(
      'BALANCE_SNAPSHOT',
      expect.objectContaining({
        format: 'XLSX',
        query: expect.objectContaining({
          schemaVersion: 1,
          timezone: 'America/New_York',
          page: 0,
        }),
      }),
    )
  })
  /**
   * Everything below the queued state used to be unverified: the single export case asserted the
   * state it started in, so download, retry, expiry and the whole restricted-recovery surface
   * could all break without failing anything.
   */
  function exportJob(overrides: Partial<ReportExportResponse> = {}): ReportExportResponse {
    const base = balanceResponse()
    return {
      id: 'export-1',
      definitionKey: 'BALANCE_SNAPSHOT',
      schemaVersion: 1,
      format: 'CSV',
      status: 'QUEUED',
      viewKey: 'BALANCE_SNAPSHOT:v1',
      displayTimezone: 'America/New_York',
      asOf: '2026-08-24T12:00:00Z',
      appliedView: base.appliedView,
      ordering: base.ordering,
      summary: base.summary,
      provenance: base.provenance,
      rowCount: 1,
      createdAt: '2026-08-24T12:01:00Z',
      expiresAt: '2026-08-31T12:01:00Z',
      fileName: 'balance-snapshot.csv',
      downloadAvailable: false,
      canRetry: false,
      ...overrides,
    }
  }

  it('[P0] offers download for a ready export and asks the server for the artifact', async () => {
    vi.spyOn(apiClient, 'queryReport').mockResolvedValue(balanceResponse())
    const ready = exportJob({ status: 'READY', downloadAvailable: true })
    vi.spyOn(apiClient, 'createReportExport').mockResolvedValue(ready)
    vi.spyOn(apiClient, 'getReportExport').mockResolvedValue(ready)
    vi.spyOn(apiClient, 'listReportExports').mockResolvedValue([])
    const downloadSpy = vi
      .spyOn(apiClient, 'downloadReportExport')
      .mockResolvedValue(new Blob(['a,b'], { type: 'text/csv' }))
    const user = userEvent.setup()

    renderPage()
    await screen.findByTestId('report-row-0')
    await user.click(screen.getByRole('button', { name: 'Create Export' }))

    const status = await screen.findByTestId('report-export-status')
    expect(status).toHaveTextContent('Ready')
    await user.click(within(status).getByRole('button', { name: 'Download Export' }))

    expect(downloadSpy).toHaveBeenCalledWith('export-1')
  })

  it('[P0] offers exactly one retry for a failed export and states the reason in words', async () => {
    vi.spyOn(apiClient, 'queryReport').mockResolvedValue(balanceResponse())
    const failed = exportJob({
      status: 'FAILED',
      canRetry: true,
      failureReason: 'RENDER_FAILED',
    })
    vi.spyOn(apiClient, 'createReportExport').mockResolvedValue(failed)
    vi.spyOn(apiClient, 'getReportExport').mockResolvedValue(failed)
    vi.spyOn(apiClient, 'listReportExports').mockResolvedValue([])
    const retrySpy = vi
      .spyOn(apiClient, 'retryReportExport')
      .mockResolvedValue(exportJob({ status: 'QUEUED' }))
    const user = userEvent.setup()

    renderPage()
    await screen.findByTestId('report-row-0')
    await user.click(screen.getByRole('button', { name: 'Create Export' }))

    const status = await screen.findByTestId('report-export-status')
    expect(status).toHaveTextContent('Failed')
    // A translated sentence, never the server's raw code or a Java class name.
    expect(status).toHaveTextContent('The file could not be generated. Try again.')
    expect(status).not.toHaveTextContent('RENDER_FAILED')

    await user.click(within(status).getByRole('button', { name: 'Retry Export' }))
    expect(retrySpy.mock.calls[0][0]).toBe('export-1')
  })

  it('[P0] explains an expired export and offers neither download nor retry', async () => {
    vi.spyOn(apiClient, 'queryReport').mockResolvedValue(balanceResponse())
    const expired = exportJob({ status: 'EXPIRED' })
    vi.spyOn(apiClient, 'createReportExport').mockResolvedValue(expired)
    vi.spyOn(apiClient, 'getReportExport').mockResolvedValue(expired)
    vi.spyOn(apiClient, 'listReportExports').mockResolvedValue([])
    const user = userEvent.setup()

    renderPage()
    await screen.findByTestId('report-row-0')
    await user.click(screen.getByRole('button', { name: 'Create Export' }))

    const status = await screen.findByTestId('report-export-status')
    expect(status).toHaveTextContent('Expired')
    expect(within(status).queryByRole('button', { name: 'Download Export' })).toBeNull()
    expect(within(status).queryByRole('button', { name: 'Retry Export' })).toBeNull()
  })

  it('[P0] keeps an existing export reachable when billing is restricted', async () => {
    // The query is correctly denied under restricted billing, so the page has no applied view.
    // The export created earlier must still be reachable - that is the whole of AC3.
    vi.spyOn(apiClient, 'queryReport').mockRejectedValue(
      new apiClient.ApiError(403, { title: 'Forbidden', detail: 'Reporting is unavailable' }),
    )
    vi.spyOn(apiClient, 'getCapabilityAccess').mockRejectedValue(
      new apiClient.ApiError(403, { title: 'Forbidden', detail: 'Not entitled' }),
    )
    const ready = exportJob({ status: 'READY', downloadAvailable: true })
    vi.spyOn(apiClient, 'listReportExports').mockResolvedValue([ready])
    const downloadSpy = vi
      .spyOn(apiClient, 'downloadReportExport')
      .mockResolvedValue(new Blob(['a,b'], { type: 'text/csv' }))
    const user = userEvent.setup()

    renderPage()

    const recovery = await screen.findByTestId('report-export-recovery')
    expect(recovery).toHaveTextContent('billing is restricted')
    const status = within(recovery).getByTestId('report-export-status')
    expect(status).toHaveTextContent('Ready')

    await user.click(within(status).getByRole('button', { name: 'Download Export' }))
    expect(downloadSpy).toHaveBeenCalledWith('export-1')
  })

  it('[P0] does not let a second export be started while one is still pending', async () => {
    vi.spyOn(apiClient, 'queryReport').mockResolvedValue(balanceResponse())
    const queued = exportJob({ status: 'QUEUED' })
    vi.spyOn(apiClient, 'createReportExport').mockResolvedValue(queued)
    vi.spyOn(apiClient, 'getReportExport').mockResolvedValue(queued)
    vi.spyOn(apiClient, 'listReportExports').mockResolvedValue([])
    const user = userEvent.setup()

    renderPage()
    await screen.findByTestId('report-row-0')
    await user.click(screen.getByRole('button', { name: 'Create Export' }))

    await screen.findByTestId('report-export-status')
    // One concurrent export per user: a second create would be a certain 429.
    expect(screen.getByRole('button', { name: 'Create Export' })).toBeDisabled()
  })
})
