import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../api/client'
import type { UserRole } from '../../api/generated/types'
import { UserMenu } from './UserMenu'

function renderUserMenu(
  role: UserRole = 'EMPLOYEE',
  variant: 'org' | 'admin' = 'org',
  userName = 'Sarah Chen',
  profileImageUrl?: string,
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
    </MemoryRouter>,
  )
  return { onSignOut }
}

describe('UserMenu ATDD — Story 9.3 profile image avatar', () => {
  it('[P0] shows uploaded profile image on the trigger when profileImageUrl is present', async () => {
    vi.spyOn(apiClient, 'getProfileImageContent').mockResolvedValue(
      new Blob(['image'], { type: 'image/png' }),
    )
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:profile'), revokeObjectURL: vi.fn() })
    renderUserMenu(
      'EMPLOYEE',
      'org',
      'Sarah Chen',
      '/api/v1/users/me/profile-image/content?v=1',
    )

    const trigger = screen.getByTestId('user-menu-trigger')
    await waitFor(() => expect(trigger.querySelector('img')).toBeInTheDocument())
    expect(screen.queryByTestId('profile-image-initials')).not.toBeInTheDocument()
  })

  it('[P0] falls back to initials when profileImageUrl is absent', () => {
    renderUserMenu('EMPLOYEE', 'org', 'Sarah Chen')

    const trigger = screen.getByTestId('user-menu-trigger')
    expect(trigger.querySelector('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('profile-image-initials')).toHaveTextContent('SC')
  })

  it('[P1] platform admin avatar uses the same image-or-initials contract', async () => {
    vi.spyOn(apiClient, 'getProfileImageContent').mockResolvedValue(
      new Blob(['image'], { type: 'image/png' }),
    )
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:profile'), revokeObjectURL: vi.fn() })
    renderUserMenu(
      'PLATFORM_ADMIN',
      'admin',
      'Riley Ops',
      '/api/v1/users/me/profile-image/content?v=3',
    )

    const trigger = screen.getByTestId('user-menu-trigger')
    await waitFor(() => expect(trigger.querySelector('img')).toBeInTheDocument())
    expect(screen.queryByTestId('profile-image-initials')).not.toBeInTheDocument()
  })
})
