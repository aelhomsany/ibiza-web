import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../api/client'
import { CreateOrganizationModal } from './CreateOrganizationModal'

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <CreateOrganizationModal onClose={onClose} />
    </QueryClientProvider>,
  )

  return { onClose }
}

describe('CreateOrganizationModal', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('submits create organization through the API mutation', async () => {
    const user = userEvent.setup()
    const createSpy = vi.spyOn(apiClient, 'createPlatformOrganization').mockResolvedValue({
      id: 2,
      name: 'Nile Tech',
      primaryContact: 'Fatima Hassan',
      initialHrAdminEmail: 'fatima@niletech.eg',
      plan: 'GROWTH',
      userCount: 1,
      userLimit: 200,
      status: 'ACTIVE',
      effectiveDate: '2026-06-25',
    })
    const { onClose } = renderModal()

    await user.type(screen.getByLabelText('Organization name'), 'Nile Tech')
    await user.type(screen.getByLabelText('Primary contact'), 'Fatima Hassan')
    await user.type(screen.getByLabelText('Initial HR Admin email'), 'fatima@niletech.eg')
    await user.selectOptions(screen.getByLabelText('Subscription plan'), 'GROWTH')
    await user.click(screen.getByRole('button', { name: 'Create Organization' }))

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        name: 'Nile Tech',
        primaryContact: 'Fatima Hassan',
        initialHrAdminEmail: 'fatima@niletech.eg',
        plan: 'GROWTH',
      })
    })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
