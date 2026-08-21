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
})
