import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as apiClient from '../../api/client'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { SettingsCategoryNav } from './SettingsCategoryNav'
import { WorkforceGroupsWeekendsCard } from './WorkforceGroupsWeekendsCard'

function mockNarrowViewport() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 900px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

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
  beforeEach(() => {
    vi.spyOn(apiClient, 'getTeamMembers').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
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

/**
 * Story 11.5 — settings category rail/tablist containment at 390px. Same
 * structure-only floor as the Story 10.9 suite above: nothing is dropped and
 * the horizontal-scroll containment + narrow-mode keyboard mapping are wired
 * correctly. Actual pixel clip at 390px is covered by Playwright.
 */
describe('SettingsCategoryNav containment ATDD — Story 11.5', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test(
    '[P0] all six categories stay reachable via scroll containment at the 390px-class breakpoint',
    async () => {
      mockNarrowViewport()
      const user = userEvent.setup()
      const onSelect = vi.fn().mockReturnValue(true)

      render(<SettingsCategoryNav activeCategory="working-calendars" onSelect={onSelect} />)

      const nav = screen.getByTestId('settings-category-nav')
      expect(nav).toHaveAttribute('role', 'region')
      // No categories dropped/truncated to fit the narrow strip.
      expect(within(nav).getAllByRole('tab')).toHaveLength(6)

      const working = screen.getByTestId('settings-category-working-calendars')
      working.focus()
      expect(working).toHaveFocus()

      // Narrow mode maps forward/backward to Left/Right (RTL-aware), not Up/Down.
      await user.keyboard('{ArrowRight}')
      await waitFor(() => {
        expect(screen.getByTestId('settings-category-leave-policies')).toHaveFocus()
      })
      expect(onSelect).toHaveBeenLastCalledWith('leave-policies')
    },
  )
})
