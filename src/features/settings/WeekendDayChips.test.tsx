import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { DayOfWeek } from '../../api/generated/types'
import { WeekendDayChips } from './WeekendDayChips'

describe('WeekendDayChips', () => {
  it('does not call onChange when deselecting the last weekend day', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn().mockResolvedValue(undefined)
    const onBlockedDeselect = vi.fn()

    render(
      <WeekendDayChips
        groupName="US"
        weekendDays={['SUNDAY']}
        onChange={onChange}
        onBlockedDeselect={onBlockedDeselect}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: /Sun weekend day for US/i }))

    expect(onChange).not.toHaveBeenCalled()
    expect(onBlockedDeselect).toHaveBeenCalled()
  })

  it('calls onChange with updated weekend days when toggling a chip', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn().mockResolvedValue(undefined)

    render(
      <WeekendDayChips
        groupName="US"
        weekendDays={['SATURDAY', 'SUNDAY']}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: /Fri weekend day for US/i }))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([
        'SATURDAY',
        'SUNDAY',
        'FRIDAY',
      ] satisfies DayOfWeek[])
    })
  })
})
