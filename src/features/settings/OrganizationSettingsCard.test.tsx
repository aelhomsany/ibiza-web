import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { OrganizationSettingsCard } from './OrganizationSettingsCard'

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole('HR_ADMIN')}>
        <OrganizationSettingsCard />
      </AuthTestProvider>
    </QueryClientProvider>,
  )
}

describe('OrganizationSettingsCard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('counts what the organization holds in the supporting rail', async () => {
    vi.spyOn(apiClient, 'getPolicySettingsOverview').mockResolvedValue({
      leaveTypes: [{}, {}, {}, {}, {}],
      users: [{}, {}, {}, {}, {}, {}],
      workforceGroups: [{}, {}],
    } as never)

    renderCard()

    await waitFor(() => expect(screen.getByTestId('glance-people')).toHaveTextContent('6'))
    expect(screen.getByTestId('glance-groups')).toHaveTextContent('2')
    expect(screen.getByTestId('glance-leave-types')).toHaveTextContent('5')
  })

  /**
   * A "0" here would be read as "this organization has no leave types", which is a different and
   * alarming claim from "not loaded yet". The rail states a figure or states nothing.
   */
  it('shows a placeholder rather than zero while the counts are unknown', async () => {
    vi.spyOn(apiClient, 'getPolicySettingsOverview').mockRejectedValue(new Error('offline'))

    renderCard()

    await waitFor(() => expect(screen.getByTestId('glance-people')).toHaveTextContent('—'))
    expect(screen.getByTestId('glance-leave-types')).not.toHaveTextContent('0')
  })
})
