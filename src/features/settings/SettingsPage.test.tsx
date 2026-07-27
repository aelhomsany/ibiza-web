import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import type { LeaveTypeResponse, TeamMemberSummaryResponse } from '../../api/generated/types'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { ToastProvider } from '../../components/ui/ToastProvider'
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

function renderSettingsPage(initialPath = '/settings') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthTestProvider value={createMockAuthForRole('HR_ADMIN')}>
            <SettingsPage />
          </AuthTestProvider>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
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
  vi.spyOn(apiClient, 'getCalendarSyncStatus').mockResolvedValue({
    provider: 'GOOGLE',
    connected: false,
    accountEmail: null,
    status: 'DISCONNECTED',
    lastErrorCategory: null,
    lastSyncedAt: null,
    nextRetryAt: null,
  })
  vi.spyOn(apiClient, 'createWorkforceGroup').mockResolvedValue({
    id: 3,
    name: 'UK',
    weekendDays: [],
  })
  vi.spyOn(apiClient, 'getNotificationPreferences').mockResolvedValue([
    {
      channel: 'IN_APP',
      scope: 'WORKFLOW',
      mandatory: true,
      enabled: true,
      mutedUntil: null,
      effectiveEnabledNow: true,
    },
    {
      channel: 'EMAIL',
      scope: 'WORKFLOW',
      mandatory: false,
      enabled: true,
      mutedUntil: null,
      effectiveEnabledNow: true,
    },
  ])
}

describe('SettingsPage', () => {
  beforeEach(() => {
    mockSettingsApis()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('[P0] renders six categories with Working calendars as the focused default', async () => {
    renderSettingsPage()

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    const nav = screen.getByTestId('settings-category-nav')
    expect(within(nav).getAllByRole('tab')).toHaveLength(6)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'US' })).toBeInTheDocument()
      expect(screen.getByTestId('working-calendars-impact')).toBeInTheDocument()
    })

    expect(screen.getByTestId('settings-category-working-calendars')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByTestId('settings-panel-working-calendars')).toBeInTheDocument()
    expect(screen.queryByTestId('leave-types-card')).not.toBeInTheDocument()
  })

  it('[P0] keeps weekend changes as a draft until explicit Save', async () => {
    const user = userEvent.setup()
    renderSettingsPage()

    const friday = await screen.findByRole('checkbox', {
      name: /Fri weekend day for US/i,
    })
    await user.click(friday)

    expect(apiClient.putWorkforceGroupWeekendDays).not.toHaveBeenCalled()
    expect(screen.getByText('Weekend pattern has unsaved changes.')).toBeInTheDocument()

    await user.click(screen.getByTestId('working-calendars-save-btn'))

    await waitFor(() => {
      expect(apiClient.putWorkforceGroupWeekendDays).toHaveBeenCalledWith(1, [
        'SATURDAY',
        'SUNDAY',
        'FRIDAY',
      ])
    })
    expect(
      await screen.findByText(/US weekend pattern saved/i),
    ).toHaveAttribute('role', 'status')
  })

  it('[P0] mounts only the selected category panel', async () => {
    const user = userEvent.setup()
    renderSettingsPage()

    await screen.findByTestId('settings-panel-working-calendars')
    await user.click(screen.getByTestId('settings-category-people'))

    expect(await screen.findByTestId('settings-panel-people')).toBeInTheDocument()
    expect(screen.getByTestId('team-members-card')).toBeInTheDocument()
    expect(screen.queryByTestId('settings-panel-working-calendars')).not.toBeInTheDocument()
    expect(screen.queryByTestId('leave-types-card')).not.toBeInTheDocument()
  })

  it('[P1] maps Notifications to the existing preference card', async () => {
    const user = userEvent.setup()
    renderSettingsPage('/settings?category=working-calendars')

    await screen.findByTestId('workforce-groups-weekends-card')
    await user.click(screen.getByTestId('settings-category-notifications'))

    expect(
      await screen.findByTestId('notification-preferences-settings'),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('calendar-sync-settings')).not.toBeInTheDocument()
    expect(screen.queryByTestId('team-members-card')).not.toBeInTheDocument()
  })

  it('[P1] maps Leave policies to the read-first leave type list', async () => {
    const user = userEvent.setup()
    renderSettingsPage('/settings?category=leave-policies')

    const list = await screen.findByTestId('leave-types-list')
    expect(within(list).getByText('Annual Leave')).toBeInTheDocument()
    expect(within(list).getByText('20 days default')).toBeInTheDocument()
    expect(within(list).getByText('Unpaid Leave')).toBeInTheDocument()
    expect(within(list).getByText('Unlimited / custom')).toBeInTheDocument()

    await user.click(screen.getByTestId('settings-category-integrations'))
    expect(await screen.findByTestId('calendar-sync-settings')).toBeInTheDocument()
  })

  it('[P2] progressively discloses infrequent group creation', async () => {
    const user = userEvent.setup()
    const putSpy = vi.spyOn(apiClient, 'putWorkforceGroupWeekendDays').mockResolvedValue({
      id: 3,
      name: 'UK',
      weekendDays: ['SATURDAY', 'SUNDAY'],
    })
    renderSettingsPage()

    await screen.findByTestId('workforce-groups-weekends-card')
    await user.click(screen.getByText('Manage Groups'))
    await user.click(screen.getByTestId('add-group-btn'))

    const modal = screen.getByTestId('workforce-group-modal')
    await user.type(within(modal).getByLabelText(/group name/i), 'UK')
    await user.click(within(modal).getByRole('checkbox', { name: 'Sun weekend day' }))
    await user.click(within(modal).getByTestId('create-group-submit'))

    await waitFor(() => {
      expect(apiClient.createWorkforceGroup).toHaveBeenCalledWith({ name: 'UK' })
      expect(putSpy).toHaveBeenCalledWith(3, expect.arrayContaining(['SATURDAY', 'SUNDAY']))
    })
  })
})
