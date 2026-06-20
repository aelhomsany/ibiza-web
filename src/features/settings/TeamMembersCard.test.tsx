import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
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
    expect(screen.getByTestId('add-member-btn')).toHaveTextContent('+ Add Member')
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
})
