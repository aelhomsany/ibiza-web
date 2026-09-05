import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as publicClient from '../../api/publicClient'
import { RegistrationFlow } from '../registration/RegistrationFlow'
import { CheckoutReturnPage } from './CheckoutReturnPage'

vi.mock('../public-site/analyticsGateway', () => ({
  emitApprovedPublicEvent: vi.fn().mockResolvedValue(undefined),
}))

const paid: publicClient.RegistrationState = {
  registrationId: 'reg-paid-124', status: 'VERIFIED', selectedPlan: 'GROWTH', intendedCount: 34,
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
    expect(review).toHaveTextContent(/GROWTH.*\$1 per active user monthly.*34 active users/i)
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
    sessionStorage.setItem('leaveo.registrationId', paid.registrationId)
    window.history.replaceState({}, '', '/register/checkout-return?outcome=success&plan=GROWTH')
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
    sessionStorage.setItem('leaveo.registrationId', paid.registrationId)
    window.history.replaceState({}, '', '/register/checkout-return?outcome=success&plan=GROWTH')
    render(<CheckoutReturnPage locale="en" />)

    expect(await screen.findByTestId('recovery-next-action')).toHaveTextContent('Complete Workspace Setup')
    expect(screen.getAllByTestId('recovery-next-action')).toHaveLength(1)
    expect(screen.queryByText(/pay again|start checkout/i)).not.toBeInTheDocument()
  })

  it('[BILLING-VAL-107/124] names provisioning as its own state once payment is authoritative', async () => {
    vi.spyOn(publicClient, 'loadRegistration').mockResolvedValue({
      ...paid, status: 'PAID_PROVISIONING', recoveryAction: null, checkoutSessionId: 'cs_123',
    })
    sessionStorage.setItem('leaveo.registrationId', paid.registrationId)
    window.history.replaceState({}, '', '/register/checkout-return?outcome=success&plan=GROWTH')
    render(<CheckoutReturnPage locale="en" />)

    const provisioning = await screen.findByTestId('provisioning-status')
    expect(provisioning).toHaveTextContent(/creating your workspace/i)
    expect(screen.getByTestId('checkout-return-confirming')).toHaveTextContent('Confirming Payment')
    expect(screen.queryByText(/payment successful|workspace ready/i)).not.toBeInTheDocument()
  })

  it('[BILLING-VAL-113] recovery route shows one paid-unprovisioned action and a support reference', async () => {
    vi.spyOn(publicClient, 'loadRegistration').mockResolvedValue({
      ...paid, status: 'PROVISIONING_FAILED', recoveryAction: 'RETRY_PROVISIONING', checkoutSessionId: 'cs_123',
    })
    window.history.replaceState({}, '', '/register/recovery?registrationId=reg-paid-124')
    render(<RegistrationFlow locale="en" route="/register/recovery" />)

    expect(await screen.findByTestId('paid-unprovisioned-recovery')).toBeVisible()
    expect(screen.getAllByTestId('recovery-next-action')).toHaveLength(1)
    expect(screen.getByTestId('support-reference')).toBeVisible()
    expect(screen.queryByTestId('checkout-start')).not.toBeInTheDocument()
    expect(screen.queryByText(/pay again|new checkout/i)).not.toBeInTheDocument()
  })

  it('[BILLING-VAL-114] an abandoned Checkout is terminal and offers exactly one resume action', async () => {
    const load = vi.spyOn(publicClient, 'loadRegistration').mockResolvedValue({
      ...paid, status: 'ABANDONED', recoveryAction: 'RESUME_CHECKOUT', checkoutSessionId: 'cs_123',
    })
    sessionStorage.setItem('leaveo.registrationId', paid.registrationId)
    window.history.replaceState({}, '', '/register/checkout-return?outcome=cancelled&plan=GROWTH')

    // ABANDONED is terminal, so the two-second poll must not be rescheduled. The previous
    // assertion waited 60 ms of real time against a 2 000 ms interval, so it passed whether or
    // not the state was terminal. Fake timers, installed before the first render so the poll is
    // scheduled against them, make it decidable — see the control case below.
    vi.useFakeTimers()
    try {
      render(<CheckoutReturnPage locale="en" />)
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })

      expect(screen.getByTestId('recovery-next-action')).toHaveTextContent('Resume Safely')
      expect(screen.getAllByTestId('recovery-next-action')).toHaveLength(1)

      await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
      expect(load).toHaveBeenCalledTimes(1)
      expect(screen.queryByText(/pay again|start checkout/i)).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('the polling assertion is decidable: a non-terminal state keeps asking the server', async () => {
    const load = vi.spyOn(publicClient, 'loadRegistration').mockResolvedValue({
      ...paid, status: 'CHECKOUT_PENDING', recoveryAction: 'WAIT_FOR_PAYMENT', checkoutSessionId: 'cs_123',
    })
    sessionStorage.setItem('leaveo.registrationId', paid.registrationId)
    window.history.replaceState({}, '', '/register/checkout-return?outcome=success&plan=GROWTH')

    vi.useFakeTimers()
    try {
      render(<CheckoutReturnPage locale="en" />)
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      expect(load).toHaveBeenCalledTimes(1)

      await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
      // Proves the terminal-state assertion above can fail: the same elapsed time re-polls here.
      expect(load.mock.calls.length).toBeGreaterThan(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('[BILLING-VAL-114] an abandoned Checkout says so instead of claiming it is still waiting', async () => {
    vi.spyOn(publicClient, 'loadRegistration').mockResolvedValue({
      ...paid, status: 'ABANDONED', recoveryAction: 'RESUME_CHECKOUT', checkoutSessionId: 'cs_123',
    })
    sessionStorage.setItem('leaveo.registrationId', paid.registrationId)
    window.history.replaceState({}, '', '/register/checkout-return?outcome=cancelled&plan=GROWTH')
    render(<CheckoutReturnPage locale="en" />)

    await screen.findByTestId('recovery-next-action')
    const panel = screen.getByTestId('checkout-return-confirming')
    expect(panel).toHaveTextContent(/not completed and has been closed/i)
    expect(panel).not.toHaveTextContent(/keep this page open|waiting for the signed/i)
  })

  it('an expired registration is terminal, says so, and still offers recovery', async () => {
    vi.spyOn(publicClient, 'loadRegistration').mockResolvedValue({
      ...paid, status: 'EXPIRED', recoveryAction: null, checkoutSessionId: null,
    })
    sessionStorage.setItem('leaveo.registrationId', paid.registrationId)
    window.history.replaceState({}, '', '/register/checkout-return?outcome=cancelled&plan=GROWTH')
    render(<CheckoutReturnPage locale="en" />)

    const action = await screen.findByTestId('recovery-next-action')
    expect(action).toHaveTextContent('Recover Registration')
    expect(action).toHaveAttribute('href', '/register/recovery')
    const panel = screen.getByTestId('checkout-return-confirming')
    expect(panel).toHaveTextContent(/expired before any payment/i)
    expect(panel).not.toHaveTextContent(/keep this page open|waiting for the signed/i)
  })

  it('[BILLING-VAL-113] provisioning in flight is stated, not offered as work to complete', async () => {
    vi.spyOn(publicClient, 'loadRegistration').mockResolvedValue({
      ...paid, status: 'PAID_PROVISIONING', recoveryAction: null, checkoutSessionId: 'cs_123',
    })
    window.history.replaceState({}, '', '/register/recovery?registrationId=reg-paid-124')
    render(<RegistrationFlow locale="en" route="/register/recovery" />)

    expect(await screen.findByTestId('paid-provisioning-status')).toBeVisible()
    // The actionable panel offered "Complete Workspace Setup" while the server was mid-provision.
    expect(screen.queryByTestId('paid-unprovisioned-recovery')).not.toBeInTheDocument()
    expect(screen.queryByTestId('recovery-next-action')).not.toBeInTheDocument()
    expect(screen.getByTestId('support-reference')).toBeVisible()
  })

  it('[BILLING-VAL-113] a recovery link persists its registration so /register can resume it', async () => {
    vi.spyOn(publicClient, 'loadRegistration').mockResolvedValue({
      ...paid, status: 'PROVISIONING_FAILED', recoveryAction: 'RETRY_PROVISIONING', checkoutSessionId: 'cs_123',
    })
    window.history.replaceState({}, '', '/register/recovery?registrationId=reg-paid-124')
    render(<RegistrationFlow locale="en" route="/register/recovery" />)

    const action = await screen.findByTestId('recovery-next-action')
    expect(action).toHaveAttribute('href', '/register')
    // /register resumes from sessionStorage only, so without this the link lands on an empty form.
    await waitFor(() =>
      expect(sessionStorage.getItem('leaveo.registrationId')).toEqual(paid.registrationId))
  })

  it('an unreadable recovery id is never persisted', async () => {
    vi.spyOn(publicClient, 'loadRegistration').mockRejectedValue(new publicClient.PublicApiError(404, null))
    window.history.replaceState({}, '', '/register/recovery?registrationId=reg-unknown')
    render(<RegistrationFlow locale="en" route="/register/recovery" />)

    await screen.findByTestId('registration-expired-recovery')
    expect(sessionStorage.getItem('leaveo.registrationId')).toBeNull()
  })

  it('[BILLING-VAL-105] a reload does not replay a spent checkout idempotency key', async () => {
    vi.spyOn(publicClient, 'verifyRegistration').mockResolvedValue(paid)
    // The verify effect strips the credentials from the URL, so the remount resumes from the
    // stored id — exactly what a customer returning to this page does.
    vi.spyOn(publicClient, 'loadRegistration').mockResolvedValue(paid)
    const checkout = vi.spyOn(publicClient, 'startRegistrationCheckout').mockResolvedValue({
      checkoutUrl: 'https://checkout.stripe.test/cs_first',
      checkoutSessionId: 'cs_first',
      status: 'CHECKOUT_PENDING',
    })
    window.history.replaceState({}, '', '/register/verify?registrationId=reg-paid-124&token=single-use')

    const first = render(<RegistrationFlow locale="en" route="/register/verify" />)
    fireEvent.click(await screen.findByTestId('checkout-start'))
    await waitFor(() => expect(checkout).toHaveBeenCalledTimes(1))
    // The customer comes back after the session expired: a fresh mount, same commitment.
    first.unmount()
    render(<RegistrationFlow locale="en" route="/register/verify" />)
    fireEvent.click(await screen.findByTestId('checkout-start'))
    await waitFor(() => expect(checkout).toHaveBeenCalledTimes(2))

    // A key the server already consumed costs a deterministic 409 on the first click after reload.
    expect(checkout.mock.calls[1][4]).not.toEqual(checkout.mock.calls[0][4])
  })

  it('[BILLING-VAL-105] a checkout idempotency conflict retries under a new key instead of re-conflicting', async () => {
    vi.spyOn(publicClient, 'verifyRegistration').mockResolvedValue(paid)
    const checkout = vi.spyOn(publicClient, 'startRegistrationCheckout')
      .mockRejectedValueOnce(new publicClient.PublicApiError(409, null))
      .mockResolvedValueOnce({
        checkoutUrl: 'https://checkout.stripe.test/cs_new',
        checkoutSessionId: 'cs_new',
        status: 'CHECKOUT_PENDING',
      })
    window.history.replaceState({}, '', '/register/verify?registrationId=reg-paid-124&token=single-use')
    render(<RegistrationFlow locale="en" route="/register/verify" />)

    const start = await screen.findByTestId('checkout-start')
    fireEvent.click(start)
    await waitFor(() => expect(checkout).toHaveBeenCalledTimes(1))
    fireEvent.click(start)
    await waitFor(() => expect(checkout).toHaveBeenCalledTimes(2))

    const firstKey = checkout.mock.calls[0][4]
    const secondKey = checkout.mock.calls[1][4]
    expect(firstKey).toBeTruthy()
    expect(secondKey).not.toEqual(firstKey)
  })
})
