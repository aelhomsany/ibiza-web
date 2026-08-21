import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isolate } from '../../i18n/bidi'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { TeamMembersCard } from './TeamMembersCard'
import type {
  TeamMemberSummaryResponse,
  WorkforceGroupResponse,
} from '../../api/generated/types'

function renderCard(
  onSuccess = vi.fn(),
  onWarning = vi.fn(),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole('HR_ADMIN')}>
        <TeamMembersCard onSuccess={onSuccess} onWarning={onWarning} />
      </AuthTestProvider>
    </QueryClientProvider>,
  )
}

const mockMembers: TeamMemberSummaryResponse[] = [
  {
    id: 1,
    fullName: 'Jordan Lee',
    email: 'jordan@company.com',
    department: 'People Ops',
    role: 'HR_ADMIN',
    workforceGroupId: 1,
    workforceGroupName: 'US',
    managerId: undefined,
    managerName: undefined,
  },
  {
    id: 2,
    fullName: 'Sarah Chen',
    email: 'sarah@company.com',
    department: 'Engineering',
    role: 'EMPLOYEE',
    workforceGroupId: 2,
    workforceGroupName: 'Egypt',
    managerId: 3,
    managerName: 'Alex Johnson',
  },
]

describe('TeamMembersCard', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getTeamMembers').mockResolvedValue(mockMembers)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('[P1] announces team members loading via role=status', () => {
    vi.spyOn(apiClient, 'getTeamMembers').mockImplementation(
      () => new Promise(() => undefined),
    )

    renderCard()

    expect(screen.getByRole('status', { name: /loading/i })).toHaveAttribute('aria-busy', 'true')
  })

  it('renders member rows after loading', async () => {
    renderCard()

    await waitFor(() => {
      expect(screen.getByTestId('team-members-list')).toBeInTheDocument()
      expect(screen.getByText('Jordan Lee')).toBeInTheDocument()
      expect(screen.getByText('Sarah Chen')).toBeInTheDocument()
    })

    // Group pills use hash-derived CSS custom properties
    const usPill = screen.getByText('US')
    const egyptPill = screen.getByText('Egypt')
    expect(usPill).toHaveClass('group-pill')
    expect(egyptPill).toHaveClass('group-pill')
    expect(usPill).not.toHaveClass('group-pill-us')
    expect(egyptPill).not.toHaveClass('group-pill-egypt')
    expect((usPill as HTMLElement).style.getPropertyValue('--pill-bg')).toBeTruthy()
    expect((egyptPill as HTMLElement).style.getPropertyValue('--pill-bg')).toBeTruthy()
    expect((usPill as HTMLElement).style.getPropertyValue('--pill-bg')).not.toBe(
      (egyptPill as HTMLElement).style.getPropertyValue('--pill-bg'),
    )
    // Manager meta shown for Sarah
    expect(screen.getByText(new RegExp(`Reports to ${isolate('Alex')}`))).toBeInTheDocument()
  })

  // Names, team names and emails are entered by users and are never translated with
  // the UI. Without `dir="auto"` they inherit the page direction, so Latin data in
  // the Arabic UI renders with its trailing punctuation at the wrong end — a name
  // like "Alex J." becomes ".Alex J". See also the ApprovalCard guard.
  it('[P0] renders user-entered member data with its own direction', async () => {
    renderCard()

    await waitFor(() => expect(screen.getByText('Sarah Chen')).toBeInTheDocument())

    // Either mechanism is acceptable: <bdi> is dir="auto" plus isolation.
    const keepsOwnDirection = (element: HTMLElement) =>
      element.tagName === 'BDI' || element.getAttribute('dir') === 'auto'

    expect(keepsOwnDirection(screen.getByText('Sarah Chen'))).toBe(true)
    expect(keepsOwnDirection(screen.getByText('Egypt'))).toBe(true)
    expect(keepsOwnDirection(screen.getByText('sarah@company.com'))).toBe(true)
  })

  it('[P1] filters the scalable people list by name, email, role, or group', async () => {
    renderCard()

    const search = await screen.findByTestId('team-members-search')
    fireEvent.change(search, { target: { value: 'Egypt' } })

    expect(screen.queryByText('Jordan Lee')).not.toBeInTheDocument()
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 2 people')

    fireEvent.change(search, { target: { value: 'no match' } })
    expect(screen.getByText('No team members match this search.')).toBeInTheDocument()
  })

  it('[P1] matches the humanized role label, not just the raw enum value', async () => {
    renderCard()

    const search = await screen.findByTestId('team-members-search')
    // Jordan Lee's role is the raw enum HR_ADMIN, displayed as "HR Admin" —
    // search must match what's shown, not just the underscored enum.
    fireEvent.change(search, { target: { value: 'HR Admin' } })

    expect(screen.getByText('Jordan Lee')).toBeInTheDocument()
    expect(screen.queryByText('Sarah Chen')).not.toBeInTheDocument()
  })

  it('[P1] matches by email address', async () => {
    renderCard()

    const search = await screen.findByTestId('team-members-search')
    fireEvent.change(search, { target: { value: 'sarah@company.com' } })

    expect(screen.getByText('Sarah Chen')).toBeInTheDocument()
    expect(screen.queryByText('Jordan Lee')).not.toBeInTheDocument()
  })

  it('[P1] clears a stale search filter after successfully adding a member', async () => {
    const mockGroups: WorkforceGroupResponse[] = [
      { id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] },
    ]
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue(mockGroups)
    vi.spyOn(apiClient, 'getLeaveTypes').mockResolvedValue([])
    vi.spyOn(apiClient, 'createTeamMember').mockResolvedValue({
      id: 9,
      fullName: 'New Hire',
      email: 'new.hire@company.com',
      department: 'Ops',
      role: 'EMPLOYEE',
      workforceGroupId: 1,
      workforceGroupName: 'US',
      managerId: undefined,
      managerName: undefined,
      entitlements: [],
    })
    const user = userEvent.setup()
    renderCard()

    const search = await screen.findByTestId('team-members-search')
    fireEvent.change(search, { target: { value: 'no match' } })
    expect(screen.getByText('No team members match this search.')).toBeInTheDocument()

    await user.click(screen.getByTestId('add-member-btn'))
    await user.type(screen.getByLabelText(/Full name/i), 'New Hire')
    await user.type(screen.getByLabelText(/Email/i), 'new.hire@company.com')
    await user.type(screen.getByLabelText(/Department/i), 'Ops')
    await user.selectOptions(screen.getByLabelText(/Workforce Group/i), '1')
    await user.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => {
      expect(screen.getByTestId('team-members-search')).toHaveValue('')
    })
    expect(screen.queryByText('No team members match this search.')).not.toBeInTheDocument()
  })

  it('renders Add Member CTA button', async () => {
    renderCard()

    expect(screen.getByTestId('add-member-btn')).toBeInTheDocument()
    expect(screen.getByTestId('add-member-btn')).toHaveTextContent('Add Member')
  })

  it('renders Edit button for each member', async () => {
    renderCard()

    await waitFor(() => {
      expect(screen.getByTestId('edit-member-1')).toBeInTheDocument()
      expect(screen.getByTestId('edit-member-2')).toBeInTheDocument()
    })
  })

  it('shows empty state when no members', async () => {
    vi.spyOn(apiClient, 'getTeamMembers').mockResolvedValue([])

    renderCard()

    await waitFor(() => {
      expect(screen.getByText('No team members yet.')).toBeInTheDocument()
    })
  })

  it('[P0][Story 8.5] renders active and deactivated status labels while keeping both rows visible', async () => {
    vi.spyOn(apiClient, 'getTeamMembers').mockResolvedValue([
      { ...mockMembers[0], status: 'ACTIVE' },
      { ...mockMembers[1], status: 'DEACTIVATED', deactivatedAt: '2026-07-04T10:00:00Z' },
    ] as TeamMemberSummaryResponse[])

    renderCard()

    await waitFor(() => {
      expect(screen.getByText('Jordan Lee')).toBeInTheDocument()
      expect(screen.getByText('Sarah Chen')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Deactivated')).toBeInTheDocument()
    })

    expect(screen.getByTestId('deactivate-member-1')).toBeInTheDocument()
    expect(screen.getByTestId('reactivate-member-2')).toBeInTheDocument()
  })

  it('[P0][Story 8.5] calls lifecycle API only after deactivation confirmation', async () => {
    const deactivateTeamMember = vi
      .spyOn(apiClient as typeof apiClient & {
        deactivateTeamMember: (id: number) => Promise<TeamMemberSummaryResponse>
      }, 'deactivateTeamMember')
      .mockResolvedValue({ ...mockMembers[1], status: 'DEACTIVATED' } as TeamMemberSummaryResponse)

    renderCard()

    await waitFor(() => {
      expect(screen.getByTestId('deactivate-member-2')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('deactivate-member-2'))

    expect(deactivateTeamMember).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Deactivate Team Member' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Deactivation' }))

    await waitFor(() => {
      expect(deactivateTeamMember).toHaveBeenCalledWith(2)
    })
  })

  it('[P1][Story 8.5] routes lifecycle success through Settings toast callback', async () => {
    const onSuccess = vi.fn()
    vi.spyOn(apiClient as typeof apiClient & {
      deactivateTeamMember: (id: number) => Promise<TeamMemberSummaryResponse>
    }, 'deactivateTeamMember')
      .mockResolvedValue({ ...mockMembers[1], status: 'DEACTIVATED' } as TeamMemberSummaryResponse)

    renderCard(onSuccess)

    await waitFor(() => {
      expect(screen.getByTestId('deactivate-member-2')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('deactivate-member-2'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Deactivation' }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('Sarah Chen deactivated')
    })
  })
})

/**
 * Story 10.10 — UXA-07 contextual accessible names for repeated row actions.
 */
describe('TeamMembersCard accessibility ATDD — Story 10.10', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getTeamMembers').mockResolvedValue(mockMembers)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('[P0] exposes member-qualified Edit and Deactivate accessible names', async () => {
    renderCard()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit.*jordan lee/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /deactivate.*jordan lee/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /edit.*sarah chen/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /deactivate.*sarah chen/i })).toBeInTheDocument()
    })
  })

  test('[P0] exposes member-qualified Reactivate accessible name for deactivated rows', async () => {
    vi.spyOn(apiClient, 'getTeamMembers').mockResolvedValue([
      { ...mockMembers[1], status: 'DEACTIVATED', deactivatedAt: '2026-07-04T10:00:00Z' },
    ] as TeamMemberSummaryResponse[])

    renderCard()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reactivate.*sarah chen/i })).toBeInTheDocument()
    })
  })
})
