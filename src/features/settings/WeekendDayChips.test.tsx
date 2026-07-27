import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { DayOfWeek } from '../../api/generated/types'
import { WeekendDayChips } from './WeekendDayChips'

describe('WeekendDayChips', () => {
  it('allows a zero-day draft so the parent can explain why Save is blocked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <WeekendDayChips
        groupName="US"
        weekendDays={['SUNDAY']}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: /Sun weekend day for US/i }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('calls onChange with updated weekend days when toggling a chip', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

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
