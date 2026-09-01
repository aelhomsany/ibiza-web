import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RowActionsMenu } from './RowActionsMenu'

function renderMenu(overrides: Partial<Parameters<typeof RowActionsMenu>[0]> = {}) {
  const onEdit = vi.fn()
  const onArchive = vi.fn()
  render(
    <RowActionsMenu
      label="More actions: Annual Leave"
      testId="row-menu"
      actions={[
        { id: 'edit', label: 'Edit', ariaLabel: 'Edit Annual Leave', onSelect: onEdit },
        { id: 'archive', label: 'Archive', destructive: true, onSelect: onArchive },
      ]}
      {...overrides}
    />,
  )
  return { onEdit, onArchive }
}

describe('RowActionsMenu', () => {
  it('[P1] keeps actions out of the row until the menu is opened', async () => {
    const user = userEvent.setup()
    const { onEdit } = renderMenu()

    const trigger = screen.getByRole('button', { name: 'More actions: Annual Leave' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu')).toHaveAccessibleName('More actions: Annual Leave')
    await user.click(screen.getByRole('menuitem', { name: 'Edit Annual Leave' }))

    expect(onEdit).toHaveBeenCalledTimes(1)
    // Selecting an action closes the menu — a stale panel over the next row is
    // how these menus usually go wrong.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('[P1] opens onto the first item from the keyboard and wraps with the arrows', async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('menuitem', { name: 'Edit Annual Leave' })).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Archive' })).toHaveFocus()

    // Past the last item, focus returns to the first rather than escaping the menu.
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Edit Annual Leave' })).toHaveFocus()
  })

  it('[P1] closes on Escape and hands focus back to the trigger', async () => {
    const user = userEvent.setup()
    renderMenu()

    const trigger = screen.getByRole('button', { name: 'More actions: Annual Leave' })
    await user.click(trigger)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('[P1] closes when a pointer lands outside without stealing focus back', async () => {
    const user = userEvent.setup()
    renderMenu()

    render(<button type="button">Elsewhere</button>)
    await user.click(screen.getByRole('button', { name: 'More actions: Annual Leave' }))
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus()
  })

  it('[P1] renders nothing when a row has no secondary actions', () => {
    render(<RowActionsMenu label="More actions" actions={[]} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
