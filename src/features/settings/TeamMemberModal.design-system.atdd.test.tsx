import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../api/client'
import type { LeaveTypeResponse, TeamMemberSummaryResponse, WorkforceGroupResponse } from '../../api/generated/types'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { TeamMemberModal } from './TeamMemberModal'

const mockGroups: WorkforceGroupResponse[] = [
  { id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] },
]

const mockLeaveTypes: LeaveTypeResponse[] = [
  {
    id: 1,
    name: 'Annual Leave',
    icon: '🌴',
    color: '#093C5D',
    backgroundColor: '#D6E8ED',
    borderColor: '#0E4F75',
    defaultBalanceDays: 20,
    displayOrder: 1,
  },
]

function renderModal() {
  vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue(mockGroups)
  vi.spyOn(apiClient, 'getLeaveTypes').mockResolvedValue(mockLeaveTypes)
  vi.spyOn(apiClient, 'getTeamMembers').mockResolvedValue([] as TeamMemberSummaryResponse[])
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole('HR_ADMIN')}>
        <TeamMemberModal
          editMemberId={null}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          onWarning={vi.fn()}
        />
      </AuthTestProvider>
    </QueryClientProvider>,
  )
}

describe('TeamMemberModal design-system ATDD — Story 10.6', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('[P1] required workforce group asterisk uses field-required class, not inline color', () => {
    const { container } = renderModal()

    const label = screen.getByText(/Workforce Group/)
    const asterisk = label.querySelector('span')
    expect(asterisk).toBeTruthy()
    expect(asterisk).toHaveClass('field-required')
    expect((asterisk as HTMLElement).style.color).toBe('')
    expect(container.querySelector('label span[style*="color"]')).toBeNull()
  })
})
