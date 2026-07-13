import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AppHeader } from './AppHeader'

describe('AppHeader i18n Layout ATDD — Story 9.4', () => {
  it.todo('[P1] Desktop header order: switcher -> bell -> avatar', () => {
    render(
      <AppHeader
        variant="org"
        title="Ibiza"
        navOpen={false}
        onToggleNav={vi.fn()}
        actions={
          <>
            <div data-testid="language-switcher" />
            <div data-testid="notification-bell" />
            <div data-testid="user-avatar" />
          </>
        }
      />
    )

    const switcher = screen.getByTestId('language-switcher')
    const bell = screen.getByTestId('notification-bell')
    const avatar = screen.getByTestId('user-avatar')

    // Check relative order (simplified for scaffold)
    expect(switcher).toBeInTheDocument()
    expect(bell).toBeInTheDocument()
    expect(avatar).toBeInTheDocument()
  })
})
