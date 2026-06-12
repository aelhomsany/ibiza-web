import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { TeamMemberModal } from './TeamMemberModal'
import type {
  LeaveTypeResponse,
  TeamMemberDetailResponse,
  TeamMemberSummaryResponse,
  WorkforceGroupResponse,
} from '../../api/generated/types'

const mockGroups: WorkforceGroupResponse[] = [
  { id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] },
  { id: 2, name: 'Egypt', weekendDays: ['FRIDAY', 'SATURDAY'] },
]

const mockLeaveTypes: LeaveTypeResponse[] = [
  { id: 1, name: 'Annual Leave', icon: '🌴', color: '#093C5D', backgroundColor: '#D6E8ED', borderColor: '#0E4F75', defaultBalanceDays: 20, displayOrder: 1 },
  { id: 2, name: 'Sick Leave', icon: '🤒', color: '#EF4444', backgroundColor: '#FEF2F2', borderColor: '#FECACA', defaultBalanceDays: 10, displayOrder: 2 },
  { id: 5, name: 'Unpaid Leave', icon: '💼', color: '#5A7A80', backgroundColor: '#ECF4E8', borderColor: '#B8DCC4', defaultBalanceDays: null, displayOrder: 5 },
]

const mockMembers: TeamMemberSummaryResponse[] = [
  { id: 3, fullName: 'Alex Johnson', email: 'alex@company.com', department: 'Engineering', role: 'MANAGER', workforceGroupId: 1, workforceGroupName: 'US', managerId: undefined, managerName: undefined },
]

function renderModal(
  editMemberId: number | null = null,
  onClose = vi.fn(),
  onSuccess = vi.fn(),
  onWarning = vi.fn(),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole('HR_ADMIN')}>
        <TeamMemberModal
          editMemberId={editMemberId}
          onClose={onClose}
          onSuccess={onSuccess}
          onWarning={onWarning}
        />
      </AuthTestProvider>
    </QueryClientProvider>,
  )
}

describe('TeamMemberModal — add mode', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue(mockGroups)
    vi.spyOn(apiClient, 'getLeaveTypes').mockResolvedValue(mockLeaveTypes)
    vi.spyOn(apiClient, 'getTeamMembers').mockResolvedValue(mockMembers)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders Add Team Member title', () => {
    renderModal()
    expect(screen.getByText('Add Team Member')).toBeInTheDocument()
  })

  it('submits createTeamMember when form is valid', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    const createSpy = vi.spyOn(apiClient, 'createTeamMember').mockResolvedValue({
      id: 99,
      fullName: 'Test Person',
      email: 'tp@company.com',
      department: 'IT',
      role: 'EMPLOYEE',
      workforceGroupId: 1,
      workforceGroupName: 'US',
      managerId: undefined,
      managerName: undefined,
      entitlements: [],
    })

    renderModal(null, vi.fn(), onSuccess)

    await user.type(screen.getByLabelText(/Full name/i), 'Test Person')
    await user.type(screen.getByLabelText(/Email/i), 'tp@company.com')
    await user.type(screen.getByLabelText(/Department/i), 'IT')
    await user.selectOptions(screen.getByLabelText(/Workforce Group/i), '1')
    await user.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Test Person',
          email: 'tp@company.com',
          department: 'IT',
          role: 'EMPLOYEE',
          workforceGroupId: 1,
        }),
      )
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('blocks Save when Workforce Group is not selected', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    renderModal(null, vi.fn(), onSuccess)

    // Fill required fields but leave group empty
    await user.type(screen.getByLabelText(/Full name/i), 'Test Person')
    await user.type(screen.getByLabelText(/Email/i), 'tp@company.com')
    await user.type(screen.getByLabelText(/Department/i), 'IT')

    await user.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Workforce Group is required')
    })
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('shows entitlement inputs only for capped leave types', async () => {
    renderModal()

    await waitFor(() => {
      // Annual Leave (capped) and Sick Leave (capped) have entitlement rows
      expect(screen.getByTestId('ent-row-1')).toBeInTheDocument()
      expect(screen.getByTestId('ent-row-2')).toBeInTheDocument()
      // Unpaid Leave (uncapped) does NOT have an entitlement row
      expect(screen.queryByTestId('ent-row-5')).not.toBeInTheDocument()
    })
  })

  it('hides Reports-to field for non-Employee roles', async () => {
    const user = userEvent.setup()
    renderModal()

    // Default role is EMPLOYEE — manager field should be visible
    await waitFor(() => {
      expect(screen.getByTestId('manager-field')).toBeInTheDocument()
    })

    // Change to MANAGER — field should disappear
    await user.selectOptions(screen.getByLabelText(/Role/i), 'MANAGER')

    expect(screen.queryByTestId('manager-field')).not.toBeInTheDocument()
  })

  it('shows Reports-to field for Employee role', async () => {
    renderModal()

    await waitFor(() => {
      expect(screen.getByTestId('manager-field')).toBeInTheDocument()
    })
  })
})

describe('TeamMemberModal — edit mode', () => {
  const mockDetail: TeamMemberDetailResponse = {
    id: 7,
    fullName: 'Priya Nair',
    email: 'priya@company.com',
    department: 'Engineering',
    role: 'EMPLOYEE',
    workforceGroupId: 1,
    workforceGroupName: 'US',
    managerId: 3,
    managerName: 'Alex Johnson',
    entitlements: [
      { leaveTypeId: 1, leaveTypeName: 'Annual Leave', allocatedDays: 20 },
      { leaveTypeId: 2, leaveTypeName: 'Sick Leave', allocatedDays: 10 },
    ],
  }

  beforeEach(() => {
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue(mockGroups)
    vi.spyOn(apiClient, 'getLeaveTypes').mockResolvedValue(mockLeaveTypes)
    vi.spyOn(apiClient, 'getTeamMembers').mockResolvedValue(mockMembers)
    vi.spyOn(apiClient, 'getTeamMember').mockResolvedValue(mockDetail)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders Edit Team Member title', async () => {
    renderModal(7)

    await waitFor(() => {
      expect(screen.getByText('Edit Team Member')).toBeInTheDocument()
    })
  })

  it('pre-fills form fields from existing member data', async () => {
    renderModal(7)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Priya Nair')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Engineering')).toBeInTheDocument()
    })
  })

  it('submits updateTeamMember when edit form is saved', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    const updateSpy = vi.spyOn(apiClient, 'updateTeamMember').mockResolvedValue(mockDetail)

    renderModal(7, vi.fn(), onSuccess)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Priya Nair')).toBeInTheDocument()
    })

    await user.clear(screen.getByLabelText(/Department/i))
    await user.type(screen.getByLabelText(/Department/i), 'Product')
    await user.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          fullName: 'Priya Nair',
          department: 'Product',
          role: 'EMPLOYEE',
          workforceGroupId: 1,
        }),
      )
      expect(onSuccess).toHaveBeenCalledWith('Team member updated.')
    })
  })

  it('does not show email field in edit mode', async () => {
    renderModal(7)

    await waitFor(() => {
      expect(screen.queryByLabelText(/Email/i)).not.toBeInTheDocument()
    })
  })
})
