import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { PendingApprovalResponse } from '../../api/generated/types'
import { ApprovalRow } from './ApprovalRow'

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

describe('ApprovalRow query feedback ATDD — Story 10.8', () => {
  test('[P1] identifies only the pending approval action as busy while disabling both row actions', () => {
    render(
      <ApprovalRow
        approval={approval}
        isApproving
        onApprove={vi.fn()}
        onDecline={vi.fn()}
      />,
    )

    expect(screen.getByTestId('approve-btn-101')).toBeDisabled()
    expect(screen.getByTestId('approve-btn-101')).toHaveAttribute('data-busy', 'true')
    expect(screen.getByTestId('decline-btn-101')).toBeDisabled()
    expect(screen.getByTestId('decline-btn-101')).not.toHaveAttribute('data-busy')
  })
})
