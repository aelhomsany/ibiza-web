import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { AppHeader } from './AppHeader'

describe('AppHeader', () => {
  it('renders the context label with the full name in the title attribute', () => {
    render(
      <AppHeader
        variant="org"
        title="Ibiza"
        contextLabel="Nile Harbor"
        navOpen={false}
        onToggleNav={vi.fn()}
      />,
    )

    const context = screen.getByTestId('app-header-context')
    expect(context).toHaveTextContent('Nile Harbor')
    expect(context).toHaveAttribute('title', 'Nile Harbor')
  })

  it('omits the context label when no organization name is available', () => {
    render(
      <AppHeader
        variant="org"
        title="Ibiza"
        contextLabel={null}
        navOpen={false}
        onToggleNav={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('app-header-context')).not.toBeInTheDocument()
  })

  it('renders actions in the header', () => {
    render(
      <AppHeader
        variant="org"
        title="Ibiza"
        actions={<button type="button">Bell</button>}
        navOpen={false}
        onToggleNav={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Bell' })).toBeInTheDocument()
  })

  it('exposes the drawer state on the hamburger and toggles it on click', async () => {
    const onToggleNav = vi.fn()
    render(
      <AppHeader
        variant="admin"
        title="Ibiza Admin"
        contextLabel="Platform Admin"
        navOpen={false}
        onToggleNav={onToggleNav}
      />,
    )

    const menu = screen.getByTestId('shell-topbar-menu')
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    expect(menu).toHaveAttribute('aria-controls', 'app-sidebar')
    expect(menu).toHaveAccessibleName('Open navigation')

    await userEvent.click(menu)
    expect(onToggleNav).toHaveBeenCalledTimes(1)
  })

  it('labels the hamburger as close navigation while the drawer is open', () => {
    render(
      <AppHeader variant="org" title="Ibiza" navOpen onToggleNav={vi.fn()} />,
    )

    const menu = screen.getByTestId('shell-topbar-menu')
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    expect(menu).toHaveAccessibleName('Close navigation')
  })
})
