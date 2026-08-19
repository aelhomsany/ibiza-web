import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { PendingApprovalResponse } from '../../api/generated/types'
import { ApprovalCard } from './ApprovalCard'

const approval: PendingApprovalResponse = {
  requestId: 101,
  employeeUserId: 7,
  employeeFullName: 'Sarah Chen',
  leaveTypeId: 1,
  leaveTypeName: 'Annual Leave',
  leaveTypeIcon: 'leave',
  leaveTypeColor: '#093C5D',
  leaveTypeBackgroundColor: '#D6E8ED',
  leaveTypeBorderColor: '#0E4F75',
  dateFrom: '2026-08-03',
  dateTo: '2026-08-07',
  workingDays: 5,
  note: null,
}

describe('ApprovalCard query feedback ATDD — Story 10.8 / 11.4', () => {
  test('[P1] identifies only the pending approval action as busy while disabling both row actions', () => {
    render(
      <ApprovalCard
        approval={approval}
        coverage={{ isLoading: false, isPartial: false, overlappingStarts: 0 }}
        isApproving
        onApprove={vi.fn()}
        onDecline={vi.fn()}
        onConcern={vi.fn()}
      />,
    )

    expect(screen.getByTestId('approve-btn-101')).toBeDisabled()
    expect(screen.getByTestId('approve-btn-101')).toHaveAttribute('data-busy', 'true')
    expect(screen.getByTestId('decline-btn-101')).toBeDisabled()
    expect(screen.getByTestId('decline-btn-101')).not.toHaveAttribute('data-busy')
  })

  test('[P1][Story 10.10] qualifies repeated approval actions with the employee name', () => {
    render(
      <ApprovalCard
        approval={approval}
        coverage={{ isLoading: false, isPartial: false, overlappingStarts: 0 }}
        onApprove={vi.fn()}
        onDecline={vi.fn()}
        onConcern={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /approve request.*sarah chen/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /decline request.*sarah chen/i })).toBeInTheDocument()
  })

  test('[P0] documentary levels offer approval or concern without balance or day guards', () => {
    render(
      <ApprovalCard
        approval={{
          ...approval,
          approvalLevel: 2,
          workingDays: 0,
          balanceCapped: true,
          balanceSufficient: false,
          approvalEvidence: [
            {
              level: 1,
              nominalApproverId: 3,
              nominalApproverFullName: 'Alex Manager',
              status: 'APPROVED',
              result: 'APPROVED',
              actualActorId: 3,
              actualActorFullName: 'Alex Manager',
              note: null,
              decidedAt: '2026-08-01T10:00:00Z',
              actedOnBehalf: false,
              current: false,
            },
            {
              level: 2,
              nominalApproverId: 9,
              nominalApproverFullName: 'Parker PM',
              status: 'PENDING',
              result: null,
              actualActorId: null,
              actualActorFullName: null,
              note: null,
              decidedAt: null,
              actedOnBehalf: false,
              current: true,
            },
          ],
        }}
        coverage={{ isLoading: false, isPartial: false, overlappingStarts: 0 }}
        onApprove={vi.fn()}
        onDecline={vi.fn()}
        onConcern={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('decline-btn-101')).not.toBeInTheDocument()
    expect(screen.getByTestId('concern-btn-101')).toBeEnabled()
    expect(screen.getByTestId('approve-btn-101')).toBeEnabled()
    expect(screen.getByText('Parker PM')).toBeInTheDocument()
  })
})
