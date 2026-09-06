import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { WorkforceGroupsWeekendsCard } from './WorkforceGroupsWeekendsCard'

function renderCard(options?: { onSuccess?: (message: string) => void; onWarning?: (message: string) => void }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const onSuccess = options?.onSuccess ?? vi.fn()
  const onWarning = options?.onWarning ?? vi.fn()
  const auth = createMockAuthForRole('ORGANIZATION_ADMIN')

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
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      { id: 1, name: 'Egypt', weekendDays: ['FRIDAY', 'SATURDAY'] },
      { id: 2, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] },
    ] as never)
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
   * Organizations are provisioned with no Workforce Groups, so this is the state every Organization Admin
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
    vi.spyOn(apiClient, 'createWorkforceGroup').mockResolvedValue({ id: 7, name: 'Cairo', weekendDays: [] })
    vi.spyOn(apiClient, 'putWorkforceGroupWeekendDays').mockResolvedValue(undefined as never)

    const { auth } = renderCard()
    await screen.findByTestId('workforce-groups-empty-state')

    await createGroupNamed(user, 'Cairo')

    await waitFor(() => {
      expect(auth.refreshUser).toHaveBeenCalled()
    })
  })

  it('does not refresh the signed-in user when a later group is created', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      { id: 1, name: 'Cairo', weekendDays: ['FRIDAY', 'SATURDAY'] },
    ])
    vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([])
    vi.spyOn(apiClient, 'createWorkforceGroup').mockResolvedValue({ id: 8, name: 'Alexandria', weekendDays: [] })
    vi.spyOn(apiClient, 'putWorkforceGroupWeekendDays').mockResolvedValue(undefined as never)

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
      { id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] },
      { id: 2, name: 'Egypt', weekendDays: ['FRIDAY', 'SATURDAY'] },
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
      { id: 1, name: 'US', weekendDays: ['SATURDAY'] },
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
})
