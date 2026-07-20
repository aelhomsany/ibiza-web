import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import * as apiClient from '../../api/client'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { WorkforceGroupsWeekendsCard } from './WorkforceGroupsWeekendsCard'

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <AuthTestProvider value={createMockAuthForRole('HR_ADMIN')}>
        <WorkforceGroupsWeekendsCard onSuccess={vi.fn()} onWarning={vi.fn()} />
      </AuthTestProvider>
    </QueryClientProvider>,
  )
}

/**
 * Story 10.9 — UXA-02 floor (structure): group nav stays keyboard-operable with visible
 * active state. Pixel clip at 390px is covered by Playwright.
 */
describe('WorkforceGroupsWeekendsCard containment ATDD — Story 10.9', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test(
    '[P1] group tabs expose selected state and remain keyboard-activatable',
    async () => {
      const user = userEvent.setup()
      vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
        { id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] },
        { id: 2, name: 'Egypt', weekendDays: ['FRIDAY', 'SATURDAY'] },
        { id: 3, name: 'Remote EMEA', weekendDays: ['SATURDAY', 'SUNDAY'] },
      ])
      vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([])

      renderCard()

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'US' })).toHaveAttribute('aria-selected', 'true')
      })

      const egyptTab = screen.getByRole('tab', { name: 'Egypt' })
      egyptTab.focus()
      expect(egyptTab).toHaveFocus()
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(egyptTab).toHaveAttribute('aria-selected', 'true')
        expect(egyptTab).toHaveClass('active')
      })

      expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Egypt')

      // Third tab proves multi-group reachability for the scroll-strip/select pattern.
      expect(screen.getByRole('tab', { name: 'Remote EMEA' })).toBeInTheDocument()
    },
  )

  test(
    '[P0] ArrowRight and ArrowLeft move tab selection with roving tabindex',
    async () => {
      const user = userEvent.setup()
      vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
        { id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] },
        { id: 2, name: 'Egypt', weekendDays: ['FRIDAY', 'SATURDAY'] },
        { id: 3, name: 'Remote EMEA', weekendDays: ['SATURDAY', 'SUNDAY'] },
      ])
      vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([])

      renderCard()

      const usTab = await screen.findByRole('tab', { name: 'US' })
      usTab.focus()
      expect(usTab).toHaveFocus()

      await user.keyboard('{ArrowRight}')

      const egyptTab = screen.getByRole('tab', { name: 'Egypt' })
      expect(egyptTab).toHaveFocus()
      expect(egyptTab).toHaveAttribute('aria-selected', 'true')
      expect(usTab).toHaveAttribute('tabindex', '-1')
      expect(egyptTab).toHaveAttribute('tabindex', '0')

      await user.keyboard('{ArrowLeft}')
      expect(usTab).toHaveFocus()
      expect(usTab).toHaveAttribute('aria-selected', 'true')
    },
  )

  test('[P0] Home and End jump to the first and last workforce group tabs', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
      { id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] },
      { id: 2, name: 'Egypt', weekendDays: ['FRIDAY', 'SATURDAY'] },
      { id: 3, name: 'Remote EMEA', weekendDays: ['SATURDAY', 'SUNDAY'] },
    ])
    vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue([])

    renderCard()

    const egyptTab = await screen.findByRole('tab', { name: 'Egypt' })
    egyptTab.focus()

    await user.keyboard('{End}')

    const lastTab = screen.getByRole('tab', { name: 'Remote EMEA' })
    expect(lastTab).toHaveFocus()
    expect(lastTab).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{Home}')

    const firstTab = screen.getByRole('tab', { name: 'US' })
    expect(firstTab).toHaveFocus()
    expect(firstTab).toHaveAttribute('aria-selected', 'true')
  })
})
