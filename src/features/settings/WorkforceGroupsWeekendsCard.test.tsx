import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { WorkforceGroupsWeekendsCard } from './WorkforceGroupsWeekendsCard'
import type { WorkforceGroupResponse } from '../../api/generated/types'

function group(partial: Partial<WorkforceGroupResponse> & Pick<WorkforceGroupResponse, 'id' | 'name' | 'weekendDays'>): WorkforceGroupResponse {
  return {
    timezone: 'America/New_York',
    currentEffectiveFrom: '2000-01-01',
    scheduledChanges: [],
    overrideCount: 0,
    ...partial,
  }
}

function renderCard(options?: { onSuccess?: (message: string) => void; onWarning?: (message: string) => void }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const onSuccess = options?.onSuccess ?? vi.fn()
  const onWarning = options?.onWarning ?? vi.fn()
  const auth = createMockAuthForRole('HR_ADMIN')

  render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={auth}>
        <WorkforceGroupsWeekendsCard onSuccess={onSuccess} onWarning={onWarning} />
      </AuthTestProvider>
    </QueryClientProvider>,
  )

  return { onSuccess, onWarning, auth }
}

/** Fills in the create-group modal and submits it. */
async function createGroupNamed(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByTestId('add-group-btn'))
  await screen.findByTestId('workforce-group-modal')
  await user.type(screen.getByLabelText('Group name'), name)
  await user.click(screen.getByTestId('create-group-submit'))
}

describe('WorkforceGroupsWeekendsCard', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getTeamMembers').mockResolvedValue([])
    vi.spyOn(apiClient, 'listWorkingWeekOverrides').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * The rail answers the two questions the editor cannot answer for itself: how far this group's
   * calendar reaches, and what the rest of the organization is set to. Its holiday figure is
   * scoped to the current year, so a holiday from a past year must not inflate it -- and it comes
   * from the same query key PublicHolidaysSection uses, so the rail cannot disagree with the list
   * it sits beside.
   */
  it('states this group\'s reach and the other groups\' weekends in the supporting rail', async () => {
    vi.restoreAllMocks()
    vi.spyOn(apiClient, 'listWorkingWeekOverrides').mockResolvedValue([])
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      group({ id: 1, name: 'Egypt', weekendDays: ['FRIDAY', 'SATURDAY'] }),
      group({ id: 2, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] }),
    ])
    vi.spyOn(apiClient, 'getTeamMembers').mockResolvedValue([
      { id: 1, fullName: 'Amina', workforceGroupId: 1, status: 'ACTIVE' },
      { id: 2, fullName: 'Karim', workforceGroupId: 1, status: 'ACTIVE' },
      { id: 3, fullName: 'Dana', workforceGroupId: 2, status: 'ACTIVE' },
    ] as never)
    vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([
      { id: 1, name: 'This year', dateFrom: `${new Date().getFullYear()}-04-10`, dateTo: `${new Date().getFullYear()}-04-12` },
      { id: 2, name: 'Last year', dateFrom: `${new Date().getFullYear() - 1}-01-01`, dateTo: `${new Date().getFullYear() - 1}-01-01` },
    ] as never)

    renderCard()

    await waitFor(() => expect(screen.getByTestId('impact-affected-people')).toHaveTextContent('2'))
    // Two weekend days for this group, so five working days.
    expect(screen.getByTestId('impact-working-days')).toHaveTextContent('5')
    // Only the holiday inside the current year counts.
    expect(screen.getByTestId('impact-holidays')).toHaveTextContent('1')

    // The group being edited is not repeated in "Other groups"; the one that is names its weekend.
    const otherGroups = screen.getByLabelText('Other groups')
    expect(otherGroups).toHaveTextContent('US')
    expect(otherGroups).toHaveTextContent(/Sun and Sat|Sat and Sun/)
    expect(otherGroups).not.toHaveTextContent('Egypt')
  })

  it('shows loading state while workforce groups are fetching', () => {
    vi.spyOn(apiClient, 'getWorkforceGroups').mockImplementation(() => new Promise(() => {}))

    renderCard()

    expect(screen.getByText('Loading workforce groups…')).toBeInTheDocument()
  })

  it('shows error state when workforce groups fail to load', async () => {
    vi.spyOn(apiClient, 'getWorkforceGroups').mockRejectedValue(new Error('Network error'))

    renderCard()

    await waitFor(() => {
      expect(screen.getByText('Unable to load workforce groups.')).toBeInTheDocument()
    })
  })

  /**
   * Organizations are provisioned with no Workforce Groups, so this is the state every HR Admin
   * lands in. The empty branch used to render a bare sentence *instead of* the card header, which
   * is where the only "add group" button lived — leaving no way to create the first group at all.
   */
  it('offers a create action from the zero-group empty state', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([])

    renderCard()

    const emptyState = await screen.findByTestId('workforce-groups-empty-state')
    expect(emptyState).toHaveTextContent('No workforce groups yet')

    await user.click(screen.getByTestId('add-group-btn'))

    expect(await screen.findByTestId('workforce-group-modal')).toBeInTheDocument()
    expect(screen.getByText('Create your first workforce group')).toBeInTheDocument()
  })

  it('does not render the group tablist while the organization has no groups', async () => {
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([])

    renderCard()

    await screen.findByTestId('workforce-groups-empty-state')
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  /**
   * Creating the organization's first group makes the server adopt every ungrouped user, which at
   * that point is only the signed-in founder. Their cached summary still reports no group, and the
   * screens gated on it (Request Leave) stay blocked until it is re-fetched.
   */
  it('refreshes the signed-in user after the first group is created', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([])
    const createSpy = vi.spyOn(apiClient, 'createWorkforceGroup').mockResolvedValue(
      group({ id: 7, name: 'Cairo', weekendDays: ['FRIDAY', 'SATURDAY'] }),
    )

    const { auth } = renderCard()
    await screen.findByTestId('workforce-groups-empty-state')

    await createGroupNamed(user, 'Cairo')

    await waitFor(() => {
      expect(auth.refreshUser).toHaveBeenCalled()
    })
    // One request carries the whole group; the signed-in admin's own zone is the offered default.
    expect(createSpy).toHaveBeenCalledWith({
      name: 'Cairo',
      timezone: 'America/New_York',
      weekendDays: ['FRIDAY', 'SATURDAY'],
    })
  })

  it('does not refresh the signed-in user when a later group is created', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      group({ id: 1, name: 'Cairo', weekendDays: ['FRIDAY', 'SATURDAY'] }),
    ])
    vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([])
    vi.spyOn(apiClient, 'createWorkforceGroup').mockResolvedValue(
      group({ id: 8, name: 'Alexandria', weekendDays: ['FRIDAY', 'SATURDAY'] }),
    )

    const { auth } = renderCard()
    await screen.findByRole('tablist')

    await createGroupNamed(user, 'Alexandria')

    await waitFor(() => {
      expect(apiClient.createWorkforceGroup).toHaveBeenCalled()
    })
    // Adoption only ever happens on the first group, so nobody's summary went stale.
    expect(auth.refreshUser).not.toHaveBeenCalled()
  })

  it('switches active group when a tab is clicked', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      group({ id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] }),
      group({ id: 2, name: 'Egypt', weekendDays: ['FRIDAY', 'SATURDAY'] }),
    ])
    vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([])

    renderCard()

    await waitFor(() => {
      expect(screen.getByText('US', { selector: '.settings-card-label span' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: 'Egypt' }))

    await waitFor(() => {
      expect(screen.getByText('Egypt', { selector: '.settings-card-label span' })).toBeInTheDocument()
    })
  })

  it('keeps the impact visible and disables Save for a zero-day draft', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      group({ id: 1, name: 'US', weekendDays: ['SATURDAY'] }),
    ])
    vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([])

    renderCard()

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /Sat weekend day for US/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('checkbox', { name: /Sat weekend day for US/i }))

    expect(screen.getByTestId('working-calendars-impact')).toBeInTheDocument()
    expect(screen.getByText('Select at least one weekend day')).toBeInTheDocument()
    expect(screen.getByTestId('working-calendars-save-btn')).toBeDisabled()
  })

  /**
   * Plan UNO: a weekend change with a "change from" date is a scheduled change. Today's pattern
   * stays in force (the response's weekendDays are unchanged), the status says when the new one
   * lands, and the change is listed with a Cancel until then.
   */
  it('schedules a weekend change from a date and can cancel it', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      group({ id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] }),
    ])
    vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([])
    const scheduled = group({
      id: 1,
      name: 'US',
      weekendDays: ['SATURDAY', 'SUNDAY'],
      scheduledChanges: [{ publicId: 'v2', weekendDays: ['FRIDAY', 'SATURDAY'], effectiveFrom: '2027-01-01' }],
    })
    const putSpy = vi.spyOn(apiClient, 'putWorkforceGroupWeekendDays').mockResolvedValue(scheduled)
    const cancelSpy = vi.spyOn(apiClient, 'cancelScheduledWeekendChange').mockResolvedValue(
      group({ id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] }),
    )

    const { onSuccess } = renderCard()

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /Sun weekend day for US/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('checkbox', { name: /Fri weekend day for US/i }))
    await user.click(screen.getByRole('checkbox', { name: /Sun weekend day for US/i }))
    fireEvent.change(screen.getByTestId('working-calendars-change-from'), { target: { value: '2027-01-01' } })
    await user.click(screen.getByTestId('working-calendars-save-btn'))

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(1, expect.arrayContaining(['FRIDAY', 'SATURDAY']), '2027-01-01')
    })
    expect(screen.getByText(/US.* weekend pattern scheduled from .*2027/)).toBeInTheDocument()
    // The draft snaps back to the pattern still in force today.
    expect(screen.getByRole('checkbox', { name: /Sun weekend day for US/i })).toBeChecked()
    expect(screen.getByTestId('working-calendars-save-btn')).toBeDisabled()

    const changes = screen.getByTestId('working-calendars-scheduled-changes')
    expect(within(changes).getByTestId('scheduled-change-v2')).toHaveTextContent(/2027.*Fri and Sat|Sat and Fri/)

    await user.click(within(changes).getByRole('button', { name: /Cancel the change scheduled for/i }))

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith(1, 'v2')
    })
    expect(onSuccess).toHaveBeenCalledWith(expect.stringMatching(/change scheduled for .*2027.* was cancelled/))
    expect(screen.queryByTestId('working-calendars-scheduled-changes')).not.toBeInTheDocument()
  })

  it('saves the time zone as soon as it is picked', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      group({ id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] }),
    ])
    vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([])
    const patchSpy = vi.spyOn(apiClient, 'patchWorkforceGroup').mockResolvedValue(
      group({ id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'], timezone: 'UTC' }),
    )

    const { onSuccess } = renderCard()

    const select = await screen.findByTestId('working-calendars-timezone')
    expect(select).toHaveValue('America/New_York')
    await user.selectOptions(select, 'UTC')

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith(1, { timezone: 'UTC' })
    })
    expect(onSuccess).toHaveBeenCalledWith(expect.stringContaining('UTC'))
    expect(screen.getByTestId('working-calendars-timezone')).toHaveValue('UTC')
  })

  /**
   * The override list is one org-wide read filtered to the active group; superseded versions are
   * history and stay out of it. Remove sends the person back to the group pattern.
   */
  it('lists the people on their own pattern for the active group and removes one', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      group({ id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'], overrideCount: 1 }),
      group({ id: 2, name: 'Egypt', weekendDays: ['FRIDAY', 'SATURDAY'] }),
    ])
    vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([])
    vi.spyOn(apiClient, 'listWorkingWeekOverrides').mockResolvedValue([
      { versionPublicId: 'o-1', subjectId: 'u-1', fullName: 'Dana', workforceGroupId: 1, workforceGroupName: 'US', weekendDays: ['FRIDAY', 'SATURDAY'], effectiveFrom: '2026-01-01', status: 'CURRENT' },
      { versionPublicId: 'o-2', subjectId: 'u-1', fullName: 'Dana', workforceGroupId: 1, workforceGroupName: 'US', weekendDays: ['SUNDAY'], effectiveFrom: '2025-01-01', status: 'SUPERSEDED' },
      { versionPublicId: 'o-3', subjectId: 'u-2', fullName: 'Amina', workforceGroupId: 2, workforceGroupName: 'Egypt', weekendDays: ['SATURDAY', 'SUNDAY'], effectiveFrom: '2026-01-01', status: 'SCHEDULED' },
    ])
    const removeSpy = vi.spyOn(apiClient, 'removeWorkingWeekOverride').mockResolvedValue(undefined)

    const { onSuccess } = renderCard()

    const list = await screen.findByTestId('overrides-list')
    expect(within(list).getByTestId('override-o-1')).toHaveTextContent('Dana')
    expect(within(list).getByTestId('override-o-1')).toHaveTextContent('In force')
    expect(within(list).queryByTestId('override-o-2')).not.toBeInTheDocument()
    expect(within(list).queryByTestId('override-o-3')).not.toBeInTheDocument()
    expect(screen.getByTestId('impact-overrides')).toHaveTextContent('1')

    await user.click(within(list).getByRole('button', { name: 'Remove the personal working week for Dana' }))

    await waitFor(() => {
      expect(removeSpy).toHaveBeenCalledWith('o-1')
    })
    expect(onSuccess).toHaveBeenCalledWith(expect.stringContaining('is back on the group pattern'))
  })

  it('offers only the active members of the group to the override modal', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      group({ id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] }),
    ])
    vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([])
    vi.spyOn(apiClient, 'getTeamMembers').mockResolvedValue([
      { id: 1, publicId: 'u-1', fullName: 'Dana', workforceGroupId: 1, status: 'ACTIVE' },
      { id: 2, publicId: 'u-2', fullName: 'Karim', workforceGroupId: 1, status: 'DEACTIVATED' },
      { id: 3, publicId: 'u-3', fullName: 'Amina', workforceGroupId: 2, status: 'ACTIVE' },
    ] as never)

    renderCard()

    // The group name is user data, so it is bidi-isolated inside the sentence.
    expect(await screen.findByTestId('overrides-empty')).toHaveTextContent(/Everyone in .?US.? follows the group pattern\./)
    await user.click(screen.getByTestId('add-override-btn'))

    const modal = await screen.findByTestId('working-week-override-modal')
    const subjects = within(modal).getByTestId('override-subjects-list')
    expect(within(subjects).getByText('Dana')).toBeInTheDocument()
    expect(within(subjects).queryByText('Karim')).not.toBeInTheDocument()
    expect(within(subjects).queryByText('Amina')).not.toBeInTheDocument()
    // The group's own pattern is the starting point, so the admin edits a difference.
    expect(within(modal).getByRole('checkbox', { name: /Sat weekend day/i })).toBeChecked()
    expect(within(modal).getByRole('checkbox', { name: /Sun weekend day/i })).toBeChecked()
  })
})
