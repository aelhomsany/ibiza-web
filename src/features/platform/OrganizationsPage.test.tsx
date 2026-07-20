import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../api/client'
import { OrganizationsPage } from './OrganizationsPage'
import { ToastProvider } from '../../components/ui/ToastProvider'
import { mockAcmeForEditSubscription } from './platformSubscriptionTestFixtures'

function renderOrganizationsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <OrganizationsPage />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('OrganizationsPage', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getPlatformOrganizations').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses wide page layout with platform subtitle and enabled create CTA', async () => {
    renderOrganizationsPage()

    expect(screen.getByTestId('organizations-page')).toHaveClass('page', 'page-wide')
    expect(screen.getByRole('heading', { name: 'Organizations' })).toBeInTheDocument()
    expect(
      screen.getByText('Provision orgs and manage subscriptions — no workforce leave data'),
    ).toBeInTheDocument()
    const createButtons = screen.getAllByRole('button', { name: /^create organization$/i })
    expect(createButtons[0]).toHaveClass(
      'btn-admin',
    )
    expect(createButtons[0]).toBeEnabled()
    expect(
      await screen.findByRole('heading', { name: 'No organizations yet' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/balance/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/approval/i)).not.toBeInTheDocument()
  })

  it('opens the create modal from the header CTA', async () => {
    const user = userEvent.setup()
    renderOrganizationsPage()

    await user.click(screen.getAllByRole('button', { name: /^create organization$/i })[0])

    expect(
      screen.getByRole('dialog', { name: 'Create Organization' }),
    ).toBeInTheDocument()
  })

  it('renders organization table with plan badge and user counts', async () => {
    vi.mocked(apiClient.getPlatformOrganizations).mockResolvedValue([
      {
        id: 1,
        name: 'Acme Corp',
        primaryContact: 'Jordan Lee',
        initialHrAdminEmail: 'jordan@company.com',
        plan: 'INTERNAL',
        userCount: 6,
        userLimit: 9999,
        status: 'ACTIVE',
        effectiveDate: '2026-06-05',
      },
      {
        id: 2,
        name: 'Nile Tech',
        primaryContact: 'Fatima Hassan',
        initialHrAdminEmail: 'fatima@niletech.eg',
        plan: 'GROWTH',
        userCount: 1,
        userLimit: 200,
        status: 'SUSPENDED',
        effectiveDate: '2026-06-25',
      },
    ])

    renderOrganizationsPage()

    expect(await screen.findByRole('heading', { name: 'All Organizations' })).toBeInTheDocument()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Jordan Lee · jordan@company.com')).toBeInTheDocument()
    expect(screen.getByText('Internal')).toHaveClass('plan-badge', 'plan-internal')
    expect(screen.getByText('6 / ∞')).toBeInTheDocument()
    expect(screen.getByText('Growth')).toHaveClass('plan-growth')
    expect(screen.getByText('1 / 200')).toBeInTheDocument()
    expect(screen.queryByText('AT LIMIT')).not.toBeInTheDocument()
    expect(screen.getByText('Suspended')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /edit subscription.*(acme corp|nile tech)/i })).toHaveLength(2)
  })

  it('[P0] shows AT LIMIT only for limited-plan organizations at or above user limit', async () => {
    vi.mocked(apiClient.getPlatformOrganizations).mockResolvedValue([
      {
        id: 1,
        name: 'Free At Limit',
        primaryContact: 'Jordan Lee',
        initialHrAdminEmail: 'jordan@free.example',
        plan: 'FREE',
        userCount: 3,
        userLimit: 3,
        status: 'ACTIVE',
        effectiveDate: '2026-07-04',
      },
      {
        id: 2,
        name: 'Starter Below Limit',
        primaryContact: 'Fatima Hassan',
        initialHrAdminEmail: 'fatima@starter.example',
        plan: 'STARTER',
        userCount: 49,
        userLimit: 50,
        status: 'ACTIVE',
        effectiveDate: '2026-07-04',
      },
      {
        id: 3,
        name: 'Growth At Limit',
        primaryContact: 'Avery Chen',
        initialHrAdminEmail: 'avery@growth.example',
        plan: 'GROWTH',
        userCount: 200,
        userLimit: 200,
        status: 'ACTIVE',
        effectiveDate: '2026-07-04',
      },
      {
        id: 4,
        name: 'Internal Over Limit',
        primaryContact: 'Sam Rivera',
        initialHrAdminEmail: 'sam@internal.example',
        plan: 'INTERNAL',
        userCount: 10000,
        userLimit: 9999,
        status: 'ACTIVE',
        effectiveDate: '2026-07-04',
      },
      {
        id: 5,
        name: 'Free Over Provisioned',
        primaryContact: 'Mona Ali',
        initialHrAdminEmail: 'mona@over.example',
        plan: 'FREE',
        userCount: 4,
        userLimit: 3,
        status: 'ACTIVE',
        effectiveDate: '2026-07-04',
      },
    ])

    renderOrganizationsPage()

    const freeAtLimitRow = await screen.findByRole('row', { name: /free at limit/i })
    expect(within(freeAtLimitRow).getByText('3 / 3')).toBeInTheDocument()
    expect(within(freeAtLimitRow).getByText('AT LIMIT')).toBeInTheDocument()

    const starterBelowLimitRow = screen.getByRole('row', { name: /starter below limit/i })
    expect(within(starterBelowLimitRow).getByText('49 / 50')).toBeInTheDocument()
    expect(within(starterBelowLimitRow).queryByText('AT LIMIT')).not.toBeInTheDocument()

    const growthAtLimitRow = screen.getByRole('row', { name: /growth at limit/i })
    expect(within(growthAtLimitRow).getByText('200 / 200')).toBeInTheDocument()
    expect(within(growthAtLimitRow).getByText('AT LIMIT')).toBeInTheDocument()

    const internalOverLimitRow = screen.getByRole('row', { name: /internal over limit/i })
    expect(within(internalOverLimitRow).getByText('10000 / ∞')).toBeInTheDocument()
    expect(within(internalOverLimitRow).queryByText('AT LIMIT')).not.toBeInTheDocument()

    const overProvisionedRow = screen.getByRole('row', { name: /free over provisioned/i })
    expect(within(overProvisionedRow).getByText('4 / 3')).toBeInTheDocument()
    expect(within(overProvisionedRow).getByText('AT LIMIT')).toBeInTheDocument()
  })

  it('[P1] renders the at-limit indicator as accessible text in the Users cell', async () => {
    vi.mocked(apiClient.getPlatformOrganizations).mockResolvedValue([
      {
        id: 1,
        name: 'Free At Limit',
        primaryContact: 'Jordan Lee',
        initialHrAdminEmail: 'jordan@free.example',
        plan: 'FREE',
        userCount: 3,
        userLimit: 3,
        status: 'ACTIVE',
        effectiveDate: '2026-07-04',
      },
    ])

    renderOrganizationsPage()

    const freeAtLimitRow = await screen.findByRole('row', { name: /free at limit/i })
    expect(within(freeAtLimitRow).getByText('3 / 3')).toBeInTheDocument()
    expect(within(freeAtLimitRow).getByTestId('org-at-limit-1')).toHaveTextContent('AT LIMIT')
    expect(within(freeAtLimitRow).getByText('AT LIMIT')).toBeVisible()
  })

  it('[P0] Edit Subscription action opens modal prefilled from row data', async () => {
    vi.mocked(apiClient.getPlatformOrganizations).mockResolvedValue([
      mockAcmeForEditSubscription,
    ])
    const user = userEvent.setup()

    renderOrganizationsPage()

    expect(await screen.findByText('Acme Corp')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /edit subscription.*acme corp/i }))

    expect(screen.getByTestId('edit-subscription-modal')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Edit Subscription — Acme Corp' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('edit-subscription-plan')).toHaveValue('INTERNAL')
    expect(screen.getByTestId('edit-subscription-billing-status')).toHaveValue('ACTIVE')
    expect(screen.getByTestId('edit-subscription-effective-date')).toHaveValue('2026-06-05')
  })
})

/**
 * Story 10.10 — UXA-07 contextual accessible name for repeated row actions.
 */
describe('OrganizationsPage accessibility ATDD — Story 10.10', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getPlatformOrganizations').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('[P0] Edit Subscription buttons include the organization name in their accessible name', async () => {
    vi.mocked(apiClient.getPlatformOrganizations).mockResolvedValue([
      {
        id: 1,
        name: 'Acme Corp',
        primaryContact: 'Jordan Lee',
        initialHrAdminEmail: 'jordan@company.com',
        plan: 'INTERNAL',
        userCount: 6,
        userLimit: 9999,
        status: 'ACTIVE',
        effectiveDate: '2026-06-05',
      },
      {
        id: 2,
        name: 'Nile Tech',
        primaryContact: 'Fatima Hassan',
        initialHrAdminEmail: 'fatima@niletech.eg',
        plan: 'GROWTH',
        userCount: 1,
        userLimit: 200,
        status: 'SUSPENDED',
        effectiveDate: '2026-06-25',
      },
    ])

    renderOrganizationsPage()

    expect(
      await screen.findByRole('button', { name: /edit subscription.*acme corp/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /edit subscription.*nile tech/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^edit subscription$/i })).not.toBeInTheDocument()
  })
})
