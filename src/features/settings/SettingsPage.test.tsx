import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import type { LeaveTypeResponse, TeamMemberSummaryResponse } from '../../api/generated/types'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { SettingsPage } from './SettingsPage'

const mockLeaveTypes: LeaveTypeResponse[] = [
  {
    id: 1,
    name: 'Annual Leave',
    icon: '🏖️',
    color: '#093C5D',
    backgroundColor: '#D6E8ED',
    borderColor: '#0E4F75',
    defaultBalanceDays: 20,
    displayOrder: 1,
  },
  {
    id: 2,
    name: 'Sick Leave',
    icon: '🤒',
    color: '#EF4444',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    defaultBalanceDays: 10,
    displayOrder: 2,
  },
  {
    id: 5,
    name: 'Unpaid Leave',
    icon: '📋',
    color: '#5A7A80',
    backgroundColor: '#ECF4E8',
    borderColor: '#B8DCC4',
    defaultBalanceDays: null,
    displayOrder: 5,
  },
]

const mockTeamMembers: TeamMemberSummaryResponse[] = [
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
]

function renderSettingsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole('HR_ADMIN')}>
        <SettingsPage />
      </AuthTestProvider>
    </QueryClientProvider>,
  )
}

function mockSettingsApis() {
  vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
    { id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] },
    { id: 2, name: 'Egypt', weekendDays: ['FRIDAY', 'SATURDAY'] },
  ])
  vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([
    {
      id: 1,
      workforceGroupId: 1,
      dateFrom: '2026-06-19',
      dateTo: '2026-06-19',
      name: 'Juneteenth',
    },
  ])
  vi.spyOn(apiClient, 'putWorkforceGroupWeekendDays').mockResolvedValue({
    id: 1,
    name: 'US',
    weekendDays: ['SATURDAY', 'SUNDAY', 'FRIDAY'],
  })
  vi.spyOn(apiClient, 'getLeaveTypes').mockResolvedValue(mockLeaveTypes)
  vi.spyOn(apiClient, 'getTeamMembers').mockResolvedValue(mockTeamMembers)
  vi.spyOn(apiClient, 'createWorkforceGroup').mockResolvedValue({
    id: 3,
    name: 'UK',
    weekendDays: [],
  })
}

describe('SettingsPage', () => {
  beforeEach(() => {
    mockSettingsApis()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders workforce group tabs and weekend chips', async () => {
    renderSettingsPage()

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'US' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Egypt' })).toBeInTheDocument()
    })

    expect(screen.getByTestId('weekend-chips')).toBeInTheDocument()
    expect(screen.getByText('Weekend days —')).toBeInTheDocument()
    expect(screen.getByText('US', { selector: '.settings-card-label span' })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('public-holidays-section')).toBeInTheDocument()
      expect(screen.getByText(/Juneteenth/)).toBeInTheDocument()
    })
  })

  it('calls PUT with updated weekend days when toggling a chip', async () => {
    const user = userEvent.setup()
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /Fri weekend day for US/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('checkbox', { name: /Fri weekend day for US/i }))

    await waitFor(() => {
      expect(apiClient.putWorkforceGroupWeekendDays).toHaveBeenCalledWith(1, [
        'SATURDAY',
        'SUNDAY',
        'FRIDAY',
      ])
    })
  })

  it('[P1] shows mockup subtitle and three policy cards in order', async () => {
    renderSettingsPage()

    expect(
      screen.getByText('Company policy, team, and leave entitlements'),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('workforce-groups-weekends-card')).toBeInTheDocument()
      expect(screen.getByTestId('leave-types-card')).toBeInTheDocument()
      expect(screen.getByTestId('team-members-card')).toBeInTheDocument()
    })

    const workforce = screen.getByTestId('workforce-groups-weekends-card')
    const leaveTypes = screen.getByTestId('leave-types-card')
    const teamMembers = screen.getByTestId('team-members-card')

    expect(
      workforce.compareDocumentPosition(leaveTypes) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      leaveTypes.compareDocumentPosition(teamMembers) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('[P2] Leave Types card lists capped and uncapped default copy', async () => {
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('leave-types-list')).toBeInTheDocument()
    })

    const list = screen.getByTestId('leave-types-list')
    expect(within(list).getByText('Annual Leave')).toBeInTheDocument()
    expect(within(list).getByText('20 days default')).toBeInTheDocument()
    expect(within(list).getByText('Unpaid Leave')).toBeInTheDocument()
    expect(within(list).getByText('Unlimited / custom')).toBeInTheDocument()
  })

  it('[P2] + Add Group opens modal and submits createWorkforceGroup', async () => {
    const user = userEvent.setup()
    const putSpy = vi.spyOn(apiClient, 'putWorkforceGroupWeekendDays').mockResolvedValue({
      id: 3,
      name: 'UK',
      weekendDays: ['SATURDAY', 'SUNDAY'],
    })

    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('add-group-btn')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('add-group-btn'))
    const modal = screen.getByTestId('workforce-group-modal')
    expect(modal).toBeInTheDocument()

    await user.type(within(modal).getByLabelText(/group name/i), 'UK')
    await user.click(within(modal).getByRole('checkbox', { name: 'Sun weekend day' }))
    await user.click(within(modal).getByTestId('create-group-submit'))

    await waitFor(() => {
      expect(apiClient.createWorkforceGroup).toHaveBeenCalledWith({ name: 'UK' })
      expect(putSpy).toHaveBeenCalledWith(3, expect.arrayContaining(['SATURDAY', 'SUNDAY']))
    })
  })
})
