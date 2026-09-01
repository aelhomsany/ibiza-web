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
  plan: 'GROWTH',
  billingStatus: 'PAST_DUE_GRACE',
  activeSeats: 14,
  pendingInvitations: 3,
  billableQuantity: 14,
  seatLimit: 200,
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

  it('[BILLING-VAL-120] restricted recovery keeps seat reduction reachable next to payment', async () => {
    vi.spyOn(client, 'getBillingSubscription').mockResolvedValue({
      ...subscription,
      billingStatus: 'RESTRICTED',
    })

    render(<BillingNotice />)

    expect(await screen.findByTestId('billing-restricted-banner')).toBeVisible()
    const reduceSeats = screen.getByTestId('cta-reduce-seats')
    expect(reduceSeats).toHaveAttribute('href', '/settings?category=people')
    expect(screen.getByTestId('cta-update-payment')).toBeVisible()
  })

  it('[BILLING-VAL-120] grace notice does not offer seat reduction as a remediation step', async () => {
    vi.spyOn(client, 'getBillingSubscription').mockResolvedValue(subscription)

    render(<BillingNotice />)

    expect(await screen.findByTestId('billing-grace-notice')).toBeVisible()
    expect(screen.queryByTestId('cta-reduce-seats')).not.toBeInTheDocument()
  })

  // The rail states the one figure neither the summary nor the provider reports: the sum the
  // seat-limit check actually applies. Doing it in your head against five separate numbers is
  // how somebody invites a person into a plan that has no room for them.
  it('[BILLING-VAL-115] states reserved seats and the headroom left against the plan limit', async () => {
    vi.spyOn(client, 'getBillingSubscription').mockResolvedValue(subscription)

    render(<ToastProvider><PlanAndBillingPage /></ToastProvider>)

    // 14 active + 3 pending = 17 reserved, against a 200-seat limit.
    expect(await screen.findByTestId('billing-reserved')).toHaveTextContent('17')
    expect(screen.getByTestId('billing-headroom')).toHaveTextContent('183')
  })

  it('[BILLING-VAL-115] clamps headroom at zero rather than reporting a negative count', async () => {
    // A plan can end up over its own limit — a downgrade scheduled before people were removed,
    // or a limit lowered on the provider's side. "-3 seats left" is not a thing to show anyone.
    vi.spyOn(client, 'getBillingSubscription').mockResolvedValue({
      ...subscription,
      activeSeats: 200,
      pendingInvitations: 3,
      seatLimit: 200,
    })

    render(<ToastProvider><PlanAndBillingPage /></ToastProvider>)

    expect(await screen.findByTestId('billing-reserved')).toHaveTextContent('203')
    expect(screen.getByTestId('billing-headroom')).toHaveTextContent('0')
  })
})
