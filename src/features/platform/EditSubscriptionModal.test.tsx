import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isolate } from '../../i18n/bidi'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../platform-auth/platformApiClient'
import { EditSubscriptionModal } from './EditSubscriptionModal'
import {
  mockAcmeForEditSubscription,
  mockUpdatedAcmeSubscription,
  validUpdateSubscriptionRequest,
} from './platformSubscriptionTestFixtures'

function renderEditSubscriptionModal(onClose = vi.fn(), onSuccess = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <EditSubscriptionModal
        organization={mockAcmeForEditSubscription}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </QueryClientProvider>,
  )

  return { onClose, onSuccess }
}

const activePromotion = {
  id: 7, campaignCode: 'Q4_SALES', startsAt: '2026-08-01T00:00:00Z',
  endsAt: '2026-12-01T00:00:00Z', revokedAt: undefined, state: 'ACTIVE' as const,
}

function renderStarterPromotionModal(
  overrides: Partial<typeof mockAcmeForEditSubscription> = {},
  onSuccess = vi.fn(),
) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <EditSubscriptionModal organization={{
        ...mockAcmeForEditSubscription,
        plan: 'STARTER',
        reportingPromotion: activePromotion,
        ...overrides,
      }} onClose={vi.fn()} onSuccess={onSuccess} />
    </QueryClientProvider>,
  )
  return { onSuccess }
}

describe('EditSubscriptionModal', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('[P0] renders prefilled subscription fields', () => {
    renderEditSubscriptionModal()

    expect(screen.getByTestId('edit-subscription-modal')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: `Edit Subscription — ${isolate('Nile Harbor')}` }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('edit-subscription-plan')).toHaveValue('INTERNAL')
    expect(screen.getByTestId('edit-subscription-billing-status')).toHaveValue('MANUAL_ACTIVE')
    expect(screen.getByTestId('edit-subscription-effective-date')).toHaveValue('2026-06-05')
  })

  it('[P0] submit calls update subscription mutation with form payload', async () => {
    const updateSubscription = vi
      .spyOn(apiClient, 'updatePlatformOrganizationSubscription')
      .mockResolvedValue(mockUpdatedAcmeSubscription)
    const user = userEvent.setup()
    const { onClose, onSuccess } = renderEditSubscriptionModal()

    await user.selectOptions(screen.getByTestId('edit-subscription-plan'), 'STARTER')
    await user.selectOptions(screen.getByTestId('edit-subscription-billing-status'), 'MANUAL_ACTIVE')
    fireEvent.change(screen.getByTestId('edit-subscription-effective-date'), {
      target: { value: '2026-06-27' },
    })
    await user.click(screen.getByTestId('edit-subscription-submit'))

    await waitFor(() => {
      expect(updateSubscription).toHaveBeenCalledWith(
        mockAcmeForEditSubscription.id,
        validUpdateSubscriptionRequest,
      )
    })
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })

  it('[P1] shows labelled Starter promotion controls and the current grant read-only', () => {
    renderStarterPromotionModal()
    expect(screen.getByRole('heading', { name: 'Advanced Reporting Promotion' })).toBeInTheDocument()
    expect(screen.getByTestId('reporting-promotion-state')).toHaveTextContent('Active')
    expect(screen.getByTestId('reporting-promotion-state')).toHaveTextContent('Q4_SALES')
    expect(screen.getByRole('button', { name: 'Revoke Promotion' })).toHaveClass('btn-danger')
    // Not prefilled: grant only ever creates a new window, and reusing the current one would
    // always collide with it server-side.
    expect(screen.getByLabelText('Campaign code')).toHaveValue('')
    expect(screen.getByLabelText('Starts')).toHaveValue('')
    expect(screen.getByLabelText('Ends')).toHaveValue('')
  })

  it('[P1] grants a promotion with the entered window, uppercased', async () => {
    const grant = vi.spyOn(apiClient, 'grantPlatformReportingPromotion')
      .mockResolvedValue(activePromotion)
    const { onSuccess } = renderStarterPromotionModal()

    await userEvent.type(screen.getByLabelText('Campaign code'), 'spring_push')
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2027-01-01' } })
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2027-03-01' } })
    await userEvent.click(screen.getByTestId('reporting-promotion-grant'))

    await waitFor(() => expect(grant).toHaveBeenCalledWith(mockAcmeForEditSubscription.id, {
      campaignCode: 'SPRING_PUSH',
      startsAt: '2027-01-01T00:00:00Z',
      endsAt: '2027-03-01T00:00:00Z',
    }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })

  it('[P1] blocks a window whose end does not follow its start without calling the API', async () => {
    const grant = vi.spyOn(apiClient, 'grantPlatformReportingPromotion')
    renderStarterPromotionModal()

    await userEvent.type(screen.getByLabelText('Campaign code'), 'BACKWARDS')
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2027-03-01' } })
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2027-01-01' } })
    await userEvent.click(screen.getByTestId('reporting-promotion-grant'))

    expect(await screen.findByTestId('reporting-promotion-error')).toHaveTextContent(
      'The end date must be after the start date')
    expect(grant).not.toHaveBeenCalled()
  })

  it('[P1] requires a second click to revoke, then calls the API with the organization id', async () => {
    const revoke = vi.spyOn(apiClient, 'revokePlatformReportingPromotion')
      .mockResolvedValue({ ...activePromotion, state: 'REVOKED' })
    renderStarterPromotionModal()

    await userEvent.click(screen.getByTestId('reporting-promotion-revoke'))
    expect(revoke).not.toHaveBeenCalled()
    expect(screen.getByTestId('reporting-promotion-revoke')).toHaveTextContent('Confirm Revoke')

    await userEvent.click(screen.getByTestId('reporting-promotion-revoke'))
    await waitFor(() => expect(revoke).toHaveBeenCalledWith(mockAcmeForEditSubscription.id))
  })

  it('[P1] hides promotion controls for a non-Starter organization', () => {
    renderStarterPromotionModal({ plan: 'FREE', reportingPromotion: undefined })
    expect(screen.queryByRole('heading', { name: 'Advanced Reporting Promotion' })).not.toBeInTheDocument()
  })

  it('[P1] labels an unrecognised promotion state as unknown rather than expired', () => {
    renderStarterPromotionModal({
      reportingPromotion: { ...activePromotion, state: 'SOMETHING_NEW' as never },
    })
    expect(screen.getByTestId('reporting-promotion-state')).toHaveTextContent('Unknown')
  })
})
