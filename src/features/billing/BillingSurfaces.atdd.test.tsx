import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as client from '../../api/client'
import { ToastProvider } from '../../components/ui/ToastProvider'
import { BillingNotice } from './BillingNotice'
import { PlanAndBillingPage } from './PlanAndBillingPage'

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: { role: 'HR_ADMIN' } }),
}))

const subscription: client.BillingSubscription = {
  plan: 'STARTER',
  billingStatus: 'PAST_DUE_GRACE',
  activeSeats: 14,
  pendingInvitations: 3,
  billableQuantity: 14,
  seatLimit: 50,
  pendingPlan: null,
  currentPeriodEnd: '2026-08-31T00:00:00Z',
  graceEndsAt: '2026-08-08T00:00:00Z',
  cancelAtPeriodEnd: false,
}

describe('Plan and billing recovery surfaces — Story 12.4', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('[BILLING-VAL-115] states active, pending-reserved, and billable quantities separately', async () => {
    vi.spyOn(client, 'getBillingSubscription').mockResolvedValue(subscription)

    render(<ToastProvider><PlanAndBillingPage /></ToastProvider>)

    const page = await screen.findByTestId('plan-and-billing-page')
    expect(page).toHaveTextContent(/Active users\s*14/i)
    expect(page).toHaveTextContent(/Pending invitations\s*3/i)
    expect(page).toHaveTextContent(/Billable quantity\s*14/i)
    expect(page).toHaveTextContent(/Pending invitations reserve paid capacity but are not billed/i)
  })

  it('[BILLING-VAL-120] keeps a persistent grace notice with payment remediation', async () => {
    vi.spyOn(client, 'getBillingSubscription').mockResolvedValue(subscription)

    render(<BillingNotice />)

    expect(await screen.findByTestId('billing-grace-notice')).toHaveAttribute('role', 'status')
    expect(screen.getByTestId('cta-update-payment')).toHaveAttribute('href', '/settings/billing')
  })

  it('[BILLING-VAL-120] announces restricted state as an alert without hiding remediation', async () => {
    vi.spyOn(client, 'getBillingSubscription').mockResolvedValue({
      ...subscription,
      billingStatus: 'RESTRICTED',
    })

    render(<BillingNotice />)

    expect(await screen.findByTestId('billing-restricted-banner')).toHaveAttribute('role', 'alert')
    expect(screen.getByTestId('cta-update-payment')).toBeVisible()
  })
})
