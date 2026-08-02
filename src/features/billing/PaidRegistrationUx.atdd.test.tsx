import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as publicClient from '../../api/publicClient'
import { RegistrationFlow } from '../registration/RegistrationFlow'
import { CheckoutReturnPage } from './CheckoutReturnPage'

vi.mock('../public-site/analyticsGateway', () => ({
  emitApprovedPublicEvent: vi.fn().mockResolvedValue(undefined),
}))

const paid: publicClient.RegistrationState = {
  registrationId: 'reg-paid-124', status: 'VERIFIED', selectedPlan: 'STARTER', intendedCount: 34,
  maskedEmail: 'p****@example.com', organizationName: 'Priya Agency', locale: 'en', country: 'US',
  timezone: 'America/New_York', safeReturnPath: '/', resendAvailableInSeconds: 0,
  workspaceCreated: false, recoveryAction: null, checkoutSessionId: null,
}

describe('Paid registration UX — Story 12.4', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('[BILLING-VAL-104] co-locates the complete paid commitment before Checkout', async () => {
    vi.spyOn(publicClient, 'verifyRegistration').mockResolvedValue(paid)
    window.history.replaceState({}, '', '/register/verify?registrationId=reg-paid-124&token=single-use')
    render(<RegistrationFlow locale="en" route="/register/verify" />)

    const review = await screen.findByTestId('paid-commitment-review')
    expect(review).toHaveTextContent(/STARTER.*\$3 per active user monthly.*34 active users/i)
    expect(review).toHaveTextContent(/recurring billing.*active users/i)
    expect(review).toHaveTextContent(/renews monthly/i)
    expect(review).toHaveTextContent(/cancel.*paid period/i)
    expect(review).toHaveTextContent(/downgrades.*renewal/i)
    expect(screen.getByTestId('checkout-start')).toBeVisible()
  })

  it('[BILLING-VAL-107] never treats browser success parameters as payment authority', async () => {
    vi.spyOn(publicClient, 'loadRegistration').mockResolvedValue({
      ...paid, status: 'CHECKOUT_PENDING', recoveryAction: 'WAIT_FOR_PAYMENT', checkoutSessionId: 'cs_123',
    })
    sessionStorage.setItem('ibiza.registrationId', paid.registrationId)
    window.history.replaceState({}, '', '/register/checkout-return?outcome=success&plan=STARTER')
    render(<CheckoutReturnPage locale="en" />)

    expect(screen.getByTestId('checkout-return-confirming')).toHaveTextContent('Confirming Payment')
    await waitFor(() => expect(publicClient.loadRegistration).toHaveBeenCalledWith(paid.registrationId))
    expect(screen.queryByText(/payment successful|workspace ready/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('recovery-next-action')).not.toBeInTheDocument()
  })

  it('[BILLING-VAL-113/114] exposes one safe action for paid-but-unprovisioned recovery', async () => {
    vi.spyOn(publicClient, 'loadRegistration').mockResolvedValue({
      ...paid, status: 'PROVISIONING_FAILED', recoveryAction: 'RETRY_PROVISIONING', checkoutSessionId: 'cs_123',
    })
    sessionStorage.setItem('ibiza.registrationId', paid.registrationId)
    window.history.replaceState({}, '', '/register/checkout-return?outcome=success&plan=STARTER')
    render(<CheckoutReturnPage locale="en" />)

    expect(await screen.findByTestId('recovery-next-action')).toHaveTextContent('Complete Workspace Setup')
    expect(screen.getAllByTestId('recovery-next-action')).toHaveLength(1)
    expect(screen.queryByText(/pay again|start checkout/i)).not.toBeInTheDocument()
  })
})
