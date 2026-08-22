import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../platform-auth/platformApiClient'
import { CreateOrganizationModal } from './CreateOrganizationModal'

const createdOrganization = {
  id: 2,
  name: 'Nile Tech',
  primaryContact: 'Fatima Hassan',
  initialHrAdminEmail: 'fatima@niletech.eg',
  plan: 'GROWTH' as const,
  userCount: 1,
  userLimit: 200,
  status: 'ACTIVE' as const,
  effectiveDate: '2026-06-25',
}

const northwindLead = {
  id: 'lead-northwind',
  companyName: 'Northwind Freight',
  contactName: 'Dana Okafor',
  contactEmail: 'dana@northwind.example',
  intendedActiveUserCount: 250,
  country: 'US',
  status: 'RECORDED',
  followUpWithdrawn: false,
  createdAt: '2026-08-01T09:00:00Z',
}

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

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Organization name'), 'Nile Tech')
  await user.type(screen.getByLabelText('Primary contact'), 'Fatima Hassan')
  await user.type(screen.getByLabelText('Initial HR Admin email'), 'fatima@niletech.eg')
  await user.selectOptions(screen.getByLabelText('Subscription plan'), 'GROWTH')
}

describe('CreateOrganizationModal', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getPlatformContactSalesLeads').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('submits create organization through the API mutation', async () => {
    const user = userEvent.setup()
    const createSpy = vi
      .spyOn(apiClient, 'createPlatformOrganization')
      .mockResolvedValue(createdOrganization)
    const { onClose } = renderModal()

    await fillRequiredFields(user)
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

  // The picker is optional and the "none" choice is the default, so an operator who ignores it
  // must not send an empty string the server would then have to interpret.
  it('omits the handoff id entirely when no lead is chosen', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getPlatformContactSalesLeads').mockResolvedValue([northwindLead])
    const createSpy = vi
      .spyOn(apiClient, 'createPlatformOrganization')
      .mockResolvedValue(createdOrganization)
    renderModal()

    await screen.findByLabelText('Contact Sales handoff (optional)')
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Create Organization' }))

    await waitFor(() => expect(createSpy).toHaveBeenCalled())
    expect(createSpy.mock.calls[0][0]).not.toHaveProperty('assistedHandoffId')
  })

  it('sends the selected lead id so the assisted funnel has a producer', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getPlatformContactSalesLeads').mockResolvedValue([northwindLead])
    const createSpy = vi
      .spyOn(apiClient, 'createPlatformOrganization')
      .mockResolvedValue(createdOrganization)
    renderModal()

    const picker = await screen.findByLabelText('Contact Sales handoff (optional)')
    await fillRequiredFields(user)
    await user.selectOptions(picker, 'lead-northwind')
    await user.click(screen.getByRole('button', { name: 'Create Organization' }))

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ assistedHandoffId: 'lead-northwind' }),
      )
    })
  })

  it('identifies each lead by company, contact and declared size', async () => {
    vi.spyOn(apiClient, 'getPlatformContactSalesLeads').mockResolvedValue([northwindLead])
    renderModal()

    expect(
      await screen.findByRole('option', { name: 'Northwind Freight — Dana Okafor (250 users)' }),
    ).toBeInTheDocument()
  })

  // A lead list that cannot be read must not block unassisted provisioning, which is the only
  // thing this form could do before the picker existed.
  it('hides the picker when the lead list is unavailable', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getPlatformContactSalesLeads').mockRejectedValue(
      new Error('lead list unavailable'),
    )
    const createSpy = vi
      .spyOn(apiClient, 'createPlatformOrganization')
      .mockResolvedValue(createdOrganization)
    const { onClose } = renderModal()

    await fillRequiredFields(user)
    expect(screen.queryByLabelText('Contact Sales handoff (optional)')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create Organization' }))
    await waitFor(() => expect(createSpy).toHaveBeenCalled())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('hides the picker when no lead is left to link', async () => {
    renderModal()

    await screen.findByLabelText('Organization name')
    expect(screen.queryByLabelText('Contact Sales handoff (optional)')).not.toBeInTheDocument()
  })
})
