import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { TeamMembersCard } from './TeamMembersCard'
import type { TeamMemberSummaryResponse } from '../../api/generated/types'

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

  it('renders member rows after loading', async () => {
    renderCard()

    await waitFor(() => {
      expect(screen.getByTestId('team-members-list')).toBeInTheDocument()
      expect(screen.getByText('Jordan Lee')).toBeInTheDocument()
      expect(screen.getByText('Sarah Chen')).toBeInTheDocument()
    })

    // Group pills are shown with UX-DR6 tint classes
    expect(document.querySelector('.group-pill-us')).toBeInTheDocument()
    expect(document.querySelector('.group-pill-egypt')).toBeInTheDocument()
    // Manager meta shown for Sarah
    expect(screen.getByText(/Reports to Alex/)).toBeInTheDocument()
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
