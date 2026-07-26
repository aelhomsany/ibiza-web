import { cleanup, render, screen } from '@testing-library/react'
import type { RecentRequestResponse } from '../../api/generated/types'
import i18n from '../../i18n/config'
import { DashboardValueProof } from './DashboardValueProof'

const request: RecentRequestResponse = {
  id: 44,
  leaveTypeId: 1,
  leaveTypeName: 'Annual Leave',
  leaveTypeIcon: '🌴',
  leaveTypeColor: '#093C5D',
  leaveTypeBackgroundColor: '#D6E8ED',
  leaveTypeBorderColor: '#0E4F75',
  dateFrom: '2026-08-10',
  dateTo: '2026-08-14',
  workingDays: 3,
  status: 'PENDING',
  statusHint: 'Waiting for approval',
  declineReason: null,
  approverFirstName: null,
}

describe('DashboardValueProof', () => {
  afterEach(async () => {
    cleanup()
    if (i18n.language !== 'en') {
      await i18n.changeLanguage('en')
    }
  })

  it('[P0] keeps stored request facts and policy visible above calculation evidence', () => {
    render(
      <DashboardValueProof
        request={request}
        workforceGroupName="US"
      />,
    )

    const proof = screen.getByTestId('dashboard-value-proof')
    expect(proof).toHaveTextContent('3 working days')
    expect(proof).toHaveTextContent('Annual Leave')
    expect(proof).toHaveTextContent('Aug 10, 2026 – Aug 14, 2026')
    expect(proof).toHaveTextContent('Waiting for approval')
    expect(proof).toHaveTextContent('Policy source: US Workforce Group')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByText('How this is calculated')).not.toBeInTheDocument()
  })

  it('[P0] maps the server English status hint to Arabic UI copy', async () => {
    await i18n.changeLanguage('ar')
    render(
      <DashboardValueProof
        request={request}
        workforceGroupName="Egypt"
      />,
    )

    const proof = screen.getByTestId('dashboard-value-proof')
    expect(proof).toHaveTextContent('بانتظار الموافقة')
    expect(proof).not.toHaveTextContent('Waiting for approval')
    expect(proof).toHaveTextContent('مصدر السياسة: مجموعة عمل Egypt')
  })

  it('[P0] labels education separately when no personal request exists', () => {
    render(<DashboardValueProof workforceGroupName="US" />)

    const proof = screen.getByTestId('dashboard-value-proof')
    expect(proof).toHaveTextContent('Working-day product guide')
    expect(proof).toHaveTextContent('Working days, counted clearly')
    expect(proof).toHaveTextContent(
      'Ibiza excludes weekends and holidays defined by your Workforce Group',
    )
  })
})
