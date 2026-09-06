import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { ApiError } from '../../api/client'
import type {
  LocationContextResponse,
  ScheduleAssignmentResponse,
  WorkScheduleResponse,
} from '../../api/generated/types'
import { ToastProvider } from '../../components/ui/ToastProvider'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { ScheduleLocationSettingsPage } from './ScheduleLocationSettingsPage'

/**
 * Added by code review 2026-08-28. The story's task list claimed this file and the spec's
 * Verification section names it, but only the modal test existed — so the page's own logic (the
 * capability-denied branch, the empty states, the working-day rendering and the assignment row)
 * had no coverage at all, and the three `getWorkSchedules`/`getLocationContexts`/
 * `listScheduleAssignments` spies added to the two settings suites were never exercised, because
 * neither of those suites ever opens this category.
 */

const schedules: WorkScheduleResponse[] = [
  {
    schedulePublicId: 'schedule-1',
    name: 'Cairo week',
    versions: [
      { versionPublicId: 'version-1', versionNumber: 1, workingDays: ['SUNDAY', 'MONDAY'] },
    ],
  },
]

const locations: LocationContextResponse[] = [
  {
    locationPublicId: 'location-1',
    name: 'Cairo office',
    code: '',
    country: 'EG',
    region: '',
    ianaTimezone: 'Africa/Cairo',
    holidayWorkforceGroupPublicId: 'group-1',
  },
]

const assignments: ScheduleAssignmentResponse[] = [
  {
    assignmentPublicId: 'assignment-1',
    scheduleVersionPublicId: 'version-1',
    locationPublicId: 'location-1',
    scope: 'WORKFORCE_GROUP',
    subjectPublicId: 'group-1',
    effectiveFrom: '2027-03-04',
    affectedMemberCount: 2,
  },
]

const overview = {
  leaveTypes: [],
  // At least one person: the bulk assignment action is disabled with nobody to assign.
  users: [{ publicId: 'user-1', name: 'Jane Doe' }],
  workforceGroups: [{ publicId: 'group-1', name: 'Egypt' }],
}

function mockLists(options: { empty?: boolean } = {}) {
  vi.spyOn(apiClient, 'getWorkSchedules').mockResolvedValue(options.empty ? [] : schedules)
  vi.spyOn(apiClient, 'getLocationContexts').mockResolvedValue(options.empty ? [] : locations)
  vi.spyOn(apiClient, 'listScheduleAssignments').mockResolvedValue(options.empty ? [] : assignments)
  vi.spyOn(apiClient, 'getScheduleAssignmentCoverage').mockResolvedValue(
    options.empty
      ? { activeMemberCount: 12, coveredMemberCount: 0, unassignedMemberCount: 12 }
      : { activeMemberCount: 12, coveredMemberCount: 9, unassignedMemberCount: 3 },
  )
  vi.spyOn(apiClient, 'getPolicySettingsOverview').mockResolvedValue(
    overview as unknown as Awaited<ReturnType<typeof apiClient.getPolicySettingsOverview>>,
  )
}

function renderPage(onWarning = vi.fn(), onSuccess = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthTestProvider value={createMockAuthForRole('ORGANIZATION_ADMIN')}>
          {/* The component calls useToast() for its standalone fallback even when the parent
              supplies onSuccess/onWarning, so a provider is required here as it is in the app. */}
          <ToastProvider>
            <ScheduleLocationSettingsPage onWarning={onWarning} onSuccess={onSuccess} />
          </ToastProvider>
        </AuthTestProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ScheduleLocationSettingsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders working days as translated names, never raw enum values', async () => {
    mockLists()

    renderPage()

    const list = await screen.findByTestId('work-schedule-list')
    expect(list).toHaveTextContent('Sun, Mon')
    // The API sends DayOfWeek enum values; they must not reach the user.
    expect(list).not.toHaveTextContent('SUNDAY')
    expect(list).not.toHaveTextContent('MONDAY')
  })

  it('labels and localizes an assignment effective date instead of printing the raw ISO string', async () => {
    mockLists()

    renderPage()

    const list = await screen.findByTestId('schedule-assignment-list')
    expect(list).toHaveTextContent('Effective from')
    expect(list).not.toHaveTextContent('2027-03-04')
    expect(list).toHaveTextContent('Mar 4, 2027')
  })

  it('names the row in each repeated New version action', async () => {
    mockLists()

    renderPage()

    expect(await screen.findByRole('button', { name: /new version of cairo week/i })).toBeInTheDocument()
  })

  /**
   * Coverage is served as its own endpoint rather than summed from the assignment rows on this
   * page: the three scopes overlap, so an ORGANIZATION row and a WORKFORCE_GROUP row both select
   * the same person and adding each row's affectedMemberCount reports more covered people than
   * the organization has. This asserts the page renders the server's answer, not a local sum --
   * the single assignment here carries affectedMemberCount 2, which is neither figure shown.
   */
  it('reports coverage from the server rather than summing the assignment rows', async () => {
    mockLists()

    renderPage()

    // The cell exists from the first paint holding an em dash, so findBy* resolves before the
    // query settles -- wait on the figure itself.
    await waitFor(() => expect(screen.getByTestId('coverage-people-covered')).toHaveTextContent('9 of 12'))
    expect(screen.getByTestId('coverage-unassigned')).toHaveTextContent('3')
  })

  it('raises a heads-up only while someone is actually uncovered', async () => {
    mockLists()

    const uncovered = renderPage()

    expect(await screen.findByText(/fall back to the organization-wide row/i)).toBeInTheDocument()
    uncovered.unmount()

    vi.restoreAllMocks()
    mockLists()
    vi.spyOn(apiClient, 'getScheduleAssignmentCoverage').mockResolvedValue({
      activeMemberCount: 12,
      coveredMemberCount: 12,
      unassignedMemberCount: 0,
    })

    renderPage()

    // Everyone is covered, so the card has nothing to say and does not render at all -- a panel
    // headed "Heads up" holding nothing is worse than no panel.
    await waitFor(() => expect(screen.getByTestId('coverage-unassigned')).toHaveTextContent('0'))
    expect(screen.queryByText(/fall back to the organization-wide row/i)).not.toBeInTheDocument()
  })

  it('shows centered empty states, not bare text, when nothing is configured', async () => {
    mockLists({ empty: true })

    renderPage()

    expect(await screen.findByTestId('work-schedule-empty-state')).toBeInTheDocument()
    expect(screen.getByTestId('location-context-empty-state')).toBeInTheDocument()
    expect(screen.getByTestId('schedule-assignment-empty-state')).toBeInTheDocument()
  })

  /**
   * `DISTRIBUTED_OPERATIONS` gained a plan-catalog row in Story 16.5, but it stays `COMING_SOON`
   * until an operator flips the release gate, so this is still the state every organization is in
   * today. Without the branch, the page rendered the ordinary
   * "nothing configured yet, create one" empty state with working create buttons whose requests
   * could only ever fail — which is exactly what the capability-unavailable code exists to prevent.
   */
  it('reports a capability denial instead of an empty page with unusable actions', async () => {
    const denial = () =>
      Promise.reject(
        new ApiError(403, {
          type: 'https://leaveo.net/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          code: 'capability-unavailable',
        } as never),
      )
    vi.spyOn(apiClient, 'getWorkSchedules').mockImplementation(denial)
    vi.spyOn(apiClient, 'getLocationContexts').mockImplementation(denial)
    vi.spyOn(apiClient, 'listScheduleAssignments').mockImplementation(denial)
    vi.spyOn(apiClient, 'getPolicySettingsOverview').mockResolvedValue(
      overview as unknown as Awaited<ReturnType<typeof apiClient.getPolicySettingsOverview>>,
    )

    renderPage()

    const banner = await screen.findByTestId('schedules-capability-unavailable')
    expect(banner).toHaveTextContent(/not available for this organization yet/i)

    await waitFor(() => {
      expect(screen.getByTestId('new-work-schedule')).toBeDisabled()
    })
    expect(screen.getByTestId('new-location-context')).toBeDisabled()
    expect(screen.getByTestId('new-schedule-assignment')).toBeDisabled()
    expect(screen.getByTestId('new-bulk-schedule-assignment')).toBeDisabled()
  })

  /**
   * Added by code review 2026-08-30. Story 16.4's entire web half shipped unreachable: the bulk
   * modal was built, translated and unit-tested, but nothing rendered it -- no button anywhere in
   * the app opened it. A modal test cannot catch that, because it mounts the modal directly. This
   * asserts the route the AC actually describes, from the page the admin is standing on.
   */
  it('opens the bulk assignment modal from the assignments header', async () => {
    const user = userEvent.setup()
    mockLists()

    renderPage()

    const bulkButton = await screen.findByTestId('new-bulk-schedule-assignment')
    await waitFor(() => {
      expect(bulkButton).toBeEnabled()
    })
    expect(screen.queryByTestId('bulk-schedule-assignment-modal')).not.toBeInTheDocument()

    await user.click(bulkButton)

    expect(await screen.findByTestId('bulk-schedule-assignment-modal')).toBeInTheDocument()
    // The roster comes from the overview query, not from a second fetch of its own.
    expect(screen.getByTestId('bulk-assignment-subjects-list')).toHaveTextContent('Jane Doe')
  })

  /**
   * A tenant is provisioned with zero Workforce Groups -- the Organization Admin creates them -- so the
   * holiday source can legitimately have nothing to offer. Without an explanation the admin sees
   * an empty required select above a button that never enables.
   */
  it('explains the empty holiday source when the organization has no workforce groups', async () => {
    const user = userEvent.setup()
    mockLists({ empty: true })
    vi.spyOn(apiClient, 'getPolicySettingsOverview').mockResolvedValue({
      ...overview,
      workforceGroups: [],
    } as unknown as Awaited<ReturnType<typeof apiClient.getPolicySettingsOverview>>)

    renderPage()

    await user.click(await screen.findByTestId('new-location-context'))

    const hint = await screen.findByTestId('location-no-groups-hint')
    expect(hint).toHaveTextContent(/takes its public holidays from a workforce group/i)
    expect(screen.getByLabelText(/Holiday source/i)).toBeDisabled()
    expect(screen.getByTestId('create-location-context-submit')).toBeDisabled()
    expect(screen.getByTestId('location-create-group-link')).toBeInTheDocument()
  })

  it('leaves the holiday source alone once workforce groups exist', async () => {
    const user = userEvent.setup()
    mockLists({ empty: true })

    renderPage()

    await user.click(await screen.findByTestId('new-location-context'))

    await waitFor(() => expect(screen.getByLabelText(/Holiday source/i)).toBeEnabled())
    expect(screen.queryByTestId('location-no-groups-hint')).not.toBeInTheDocument()
  })
})
