import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
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

const overview = { leaveTypes: [], users: [], workforceGroups: [{ publicId: 'group-1', name: 'Egypt' }] }

function mockLists(options: { empty?: boolean } = {}) {
  vi.spyOn(apiClient, 'getWorkSchedules').mockResolvedValue(options.empty ? [] : schedules)
  vi.spyOn(apiClient, 'getLocationContexts').mockResolvedValue(options.empty ? [] : locations)
  vi.spyOn(apiClient, 'listScheduleAssignments').mockResolvedValue(options.empty ? [] : assignments)
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
        <AuthTestProvider value={createMockAuthForRole('HR_ADMIN')}>
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

  it('shows centered empty states, not bare text, when nothing is configured', async () => {
    mockLists({ empty: true })

    renderPage()

    expect(await screen.findByTestId('work-schedule-empty-state')).toBeInTheDocument()
    expect(screen.getByTestId('location-context-empty-state')).toBeInTheDocument()
    expect(screen.getByTestId('schedule-assignment-empty-state')).toBeInTheDocument()
  })

  /**
   * `DISTRIBUTED_OPERATIONS` carries no plan-catalog entry through Stories 16.1-16.4, so this is
   * the state every organization is in today. Without the branch, the page rendered the ordinary
   * "nothing configured yet, create one" empty state with working create buttons whose requests
   * could only ever fail — which is exactly what the capability-unavailable code exists to prevent.
   */
  it('reports a capability denial instead of an empty page with unusable actions', async () => {
    const denial = () =>
      Promise.reject(
        new ApiError(403, {
          type: 'https://ibiza.app/errors/forbidden',
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
  })
})
