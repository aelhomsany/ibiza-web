import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { RecentRequestResponse } from '../../api/generated/types'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { RecentRequestsCard } from './RecentRequestsCard'

const mockRecentRequests: RecentRequestResponse[] = [
  {
    id: 1,
    leaveTypeId: 1,
    leaveTypeName: 'Annual Leave',
    leaveTypeIcon: 'leave',
    leaveTypeColor: '#093C5D',
    leaveTypeBackgroundColor: '#D6E8ED',
    leaveTypeBorderColor: '#0E4F75',
    dateFrom: '2026-06-10',
    dateTo: '2026-06-14',
    workingDays: 3,
    status: 'PENDING',
    statusHint: 'Waiting for approval',
    declineReason: null,
    approverFirstName: null,
  },
]

function renderCard(requests = mockRecentRequests) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole('EMPLOYEE')}>
        <RecentRequestsCard requests={requests} />
      </AuthTestProvider>
    </QueryClientProvider>,
  )
}

/**
 * Story 10.9 — UXA-04 floor: intentional horizontal table regions are keyboard-focusable
 * and accessibly named.
 */
describe('RecentRequestsCard containment ATDD — Story 10.9', () => {
  test(
    '[P1] recent-requests .table-wrap is a focusable labelled region (role=region, tabIndex=0)',
    () => {
      renderCard()

      const region = screen.getByRole('region', { name: /recent requests/i })
      expect(region).toHaveClass('table-wrap')
      expect(region).toHaveAttribute('tabindex', '0')
    },
  )

  test(
    '[P1] ArrowRight scrolls a labelled table region when horizontal overflow exists',
    async () => {
      renderCard()

      const region = screen.getByRole('region', { name: /recent requests/i })
      Object.defineProperty(region, 'scrollWidth', { configurable: true, value: 640 })
      Object.defineProperty(region, 'clientWidth', { configurable: true, value: 320 })
      region.scrollLeft = 0

      region.focus()
      fireEvent.keyDown(region, { key: 'ArrowRight' })

      expect(region.scrollLeft).toBeGreaterThan(0)
    },
  )

  test(
    '[P1] exposes an accessible scroll hint via aria-describedby on the table region',
    () => {
      renderCard()

      const region = screen.getByRole('region', { name: /recent requests/i })
      const describedBy = region.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()

      const hint = document.getElementById(describedBy!)
      expect(hint).toBeTruthy()
      expect(hint).toHaveTextContent(/arrow|scroll/i)
    },
  )
})
