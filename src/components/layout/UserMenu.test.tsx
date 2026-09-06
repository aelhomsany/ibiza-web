import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import type { UserRole } from '../../api/generated/types'
import { UserMenu } from './UserMenu'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location-path">{location.pathname}</output>
}

function renderUserMenu(
  role: UserRole = 'EMPLOYEE',
  variant: 'org' | 'admin' = 'org',
  userName = 'Sarah Chen',
  profileImageUrl?: string | null,
) {
  const onSignOut = vi.fn()
  render(
    <MemoryRouter>
      <UserMenu
        userName={userName}
        userRole={role}
        profileImageUrl={profileImageUrl}
        onSignOut={onSignOut}
        variant={variant}
      />
      <LocationProbe />
    </MemoryRouter>,
  )
  return { onSignOut }
}

async function openMenu() {
  const trigger = screen.getByTestId('user-menu-trigger')
  await userEvent.click(trigger)
  return trigger
}

describe('UserMenu', () => {
  it('[P0] opens the dropdown on click', async () => {
    renderUserMenu()
    await openMenu()
    expect(screen.getByTestId('user-menu-panel')).toBeInTheDocument()
    expect(screen.getByTestId('user-menu-trigger')).toHaveAttribute('aria-expanded', 'true')
  })

  it('[P0] opens the dropdown on Enter', async () => {
    renderUserMenu()
    const trigger = screen.getByTestId('user-menu-trigger')
    trigger.focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByTestId('user-menu-panel')).toBeInTheDocument()
  })

  it('[P0] opens the dropdown on Space', async () => {
    renderUserMenu()
    const trigger = screen.getByTestId('user-menu-trigger')
    trigger.focus()
    await userEvent.keyboard(' ')
    expect(screen.getByTestId('user-menu-panel')).toBeInTheDocument()
  })

  it('[P0] opens the dropdown on ArrowDown', async () => {
    renderUserMenu()
    const trigger = screen.getByTestId('user-menu-trigger')
    trigger.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByTestId('user-menu-panel')).toBeInTheDocument()
  })

  it('[P1] shows name, role, and org menu items in order', async () => {
    renderUserMenu('EMPLOYEE')
    await openMenu()

    const panel = screen.getByTestId('user-menu-panel')
    expect(within(panel).getByText('Sarah Chen')).toBeInTheDocument()
    expect(within(panel).getByText('Employee')).toBeInTheDocument()

    const items = within(panel).getAllByRole('menuitem')
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'Profile details',
      'My Requests',
      'Sign out',
    ])
    expect(within(panel).getByRole('separator')).toBeInTheDocument()
  })

  it('[P0] shows Settings only for ORGANIZATION_ADMIN', async () => {
    renderUserMenu('ORGANIZATION_ADMIN')
    await openMenu()

    expect(screen.getByTestId('user-menu-item-settings')).toBeInTheDocument()
  })

  it('[P0] hides Settings for EMPLOYEE', async () => {
    renderUserMenu('EMPLOYEE')
    await openMenu()

    expect(screen.queryByTestId('user-menu-item-settings')).not.toBeInTheDocument()
  })

  it('[P0] hides Settings for MANAGER', async () => {
    renderUserMenu('MANAGER')
    await openMenu()

    expect(screen.queryByTestId('user-menu-item-settings')).not.toBeInTheDocument()
  })

  it('[P1] navigates to My Requests and closes the menu', async () => {
    renderUserMenu('EMPLOYEE')
    await openMenu()

    await userEvent.click(screen.getByTestId('user-menu-item-my-requests'))
    expect(screen.getByTestId('location-path')).toHaveTextContent('/my-leaves')
    expect(screen.queryByTestId('user-menu-panel')).not.toBeInTheDocument()
  })

  it('[P1] navigates Organization admins to Settings and closes the menu', async () => {
    renderUserMenu('ORGANIZATION_ADMIN')
    await openMenu()

    await userEvent.click(screen.getByTestId('user-menu-item-settings'))
    expect(screen.getByTestId('location-path')).toHaveTextContent('/settings')
    expect(screen.queryByTestId('user-menu-panel')).not.toBeInTheDocument()
  })

  it('[P2] navigates to Profile details and closes the menu', async () => {
    renderUserMenu('EMPLOYEE')
    await openMenu()

    await userEvent.click(screen.getByTestId('user-menu-item-profile'))
    // Anchored: '/profile' is a substring of the admin variant's '/app-admin/profile',
    // so an org -> admin regression would slip past a bare toHaveTextContent.
    expect(screen.getByTestId('location-path').textContent).toBe('/profile')
    expect(screen.queryByTestId('user-menu-panel')).not.toBeInTheDocument()
  })

  it('[P0] calls onSignOut when Sign out is selected', async () => {
    const { onSignOut } = renderUserMenu('EMPLOYEE')
    await openMenu()

    await userEvent.click(screen.getByTestId('user-menu-item-sign-out'))
    expect(onSignOut).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('user-menu-panel')).not.toBeInTheDocument()
  })

  it('[P1] closes on Escape and returns focus to the trigger', async () => {
    renderUserMenu()
    const trigger = await openMenu()
    const profileItem = screen.getByTestId('user-menu-item-profile')
    profileItem.focus()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByTestId('user-menu-panel')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('[P1] closes when clicking outside', async () => {
    renderUserMenu()
    await openMenu()

    await userEvent.click(document.body)
    expect(screen.queryByTestId('user-menu-panel')).not.toBeInTheDocument()
  })

  it('[P1] moves focus between items with ArrowDown and ArrowUp', async () => {
    renderUserMenu('ORGANIZATION_ADMIN')
    await openMenu()

    const profile = screen.getByTestId('user-menu-item-profile')
    const myRequests = screen.getByTestId('user-menu-item-my-requests')
    const settings = screen.getByTestId('user-menu-item-settings')

    profile.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(myRequests).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    expect(settings).toHaveFocus()

    await userEvent.keyboard('{ArrowUp}')
    expect(myRequests).toHaveFocus()
  })

  it('[P1] renders initials from fullName on the trigger', () => {
    renderUserMenu('EMPLOYEE', 'org', 'Alex Johnson')
    expect(screen.getByTestId('profile-image-initials')).toHaveTextContent('AJ')
  })

  it('[P0] shows uploaded profile image on the trigger when profileImageUrl is present', async () => {
    vi.spyOn(apiClient, 'getProfileImageContent').mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:profile'), revokeObjectURL: vi.fn() })
    renderUserMenu(
      'EMPLOYEE',
      'org',
      'Sarah Chen',
      '/api/v1/users/me/profile-image/content?v=1',
    )

    await waitFor(() => {
      expect(screen.getByTestId('user-menu-trigger').querySelector('img')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('profile-image-initials')).not.toBeInTheDocument()
  })

  it('[P0] falls back to initials when profileImageUrl is absent', () => {
    renderUserMenu('EMPLOYEE', 'org', 'Sarah Chen')

    expect(screen.getByTestId('profile-image-initials')).toHaveTextContent('SC')
    expect(screen.getByTestId('user-menu-trigger').querySelector('img')).not.toBeInTheDocument()
  })

  it('[P1] admin variant omits My Requests and Settings', async () => {
    renderUserMenu('PLATFORM_ADMIN', 'admin', 'Riley Morgan')
    await openMenu()

    expect(screen.getByTestId('user-menu-item-profile')).toBeInTheDocument()
    expect(screen.queryByTestId('user-menu-item-my-requests')).not.toBeInTheDocument()
    expect(screen.queryByTestId('user-menu-item-settings')).not.toBeInTheDocument()
    expect(screen.getByTestId('user-menu-item-sign-out')).toBeInTheDocument()
    expect(within(screen.getByTestId('user-menu-panel')).getByText('Platform Admin')).toBeInTheDocument()
  })

  it('[P0] admin variant links Profile to the admin profile route', async () => {
    renderUserMenu('PLATFORM_ADMIN', 'admin', 'Riley Morgan')
    await openMenu()

    await userEvent.click(screen.getByTestId('user-menu-item-profile'))

    await waitFor(() => {
      expect(screen.getByTestId('location-path').textContent).toBe('/app-admin/profile')
    })
    expect(screen.queryByTestId('user-menu-panel')).not.toBeInTheDocument()
  })

  it('[P0] ArrowDown focuses the first item after the menu is opened by mouse click', async () => {
    renderUserMenu('EMPLOYEE')
    await openMenu()

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByTestId('user-menu-item-profile')).toHaveFocus()
  })

  it('[P0] closes the menu when focus leaves via Tab', async () => {
    renderUserMenu('EMPLOYEE')
    await openMenu()

    screen.getByTestId('user-menu-item-sign-out').focus()
    await userEvent.tab()

    expect(screen.queryByTestId('user-menu-panel')).not.toBeInTheDocument()
  })

  it('[P1] Space activates a Link-based menu item', async () => {
    renderUserMenu('EMPLOYEE')
    await openMenu()

    screen.getByTestId('user-menu-item-my-requests').focus()
    await userEvent.keyboard(' ')

    expect(screen.queryByTestId('user-menu-panel')).not.toBeInTheDocument()
  })

})
