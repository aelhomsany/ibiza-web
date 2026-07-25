import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../api/client'
import { AuthTestProvider, createMockAuthForRole, mockUsers } from '../../test/authTestUtils'
import { ToastProvider } from '../../components/ui/ToastProvider'
import { ProfilePage } from './ProfilePage'

const mockUserWithImage = {
  id: 2,
  email: 'sarah@company.com',
  fullName: 'Sarah Chen',
  role: 'EMPLOYEE' as const,
  organizationId: 1,
  organizationName: 'Nile Harbor',
  timezone: 'America/New_York',
  workforceGroupName: 'US',
  preferredLanguage: null,
  profileImageUrl: '/api/v1/users/me/profile-image/content?v=1',
}

function renderProfilePage(authOverrides = createMockAuthForRole('EMPLOYEE')) {
  return render(
    <ToastProvider>
      <AuthTestProvider value={authOverrides}>
        <ProfilePage />
      </AuthTestProvider>
    </ToastProvider>,
  )
}

describe('ProfilePage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('[P0] renders full-bleed profile summary with current-user fields', async () => {
    renderProfilePage(createMockAuthForRole('EMPLOYEE'))

    expect(screen.getByTestId('profile-page')).toHaveClass('page', 'page-wide')
    expect(screen.getByRole('heading', { name: 'Profile details' })).toBeInTheDocument()
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument()
    expect(screen.getByText('sarah@company.com')).toBeInTheDocument()
    expect(screen.getByText('Employee')).toBeInTheDocument()
    expect(screen.getByText('US')).toBeInTheDocument()
    expect(screen.getByText('America/New_York')).toBeInTheDocument()
    expect(screen.getByText('Not set')).toBeInTheDocument()
  })

  it('[P0] upload success refreshes shared auth state so the header avatar can update', async () => {
    const refreshUser = vi.fn().mockResolvedValue(mockUserWithImage)
    vi.spyOn(apiClient, 'uploadProfileImage').mockResolvedValue(mockUserWithImage)

    renderProfilePage({
      ...createMockAuthForRole('EMPLOYEE'),
      refreshUser,
    })

    const file = new File([new Uint8Array([137, 80, 78, 71])], 'avatar.png', {
      type: 'image/png',
    })
    const input = screen.getByTestId('profile-image-input')
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(apiClient.uploadProfileImage).toHaveBeenCalledWith(file)
      expect(refreshUser).toHaveBeenCalledTimes(1)
    })
  })

  it('[P1] removing the profile image calls the API and refreshes shared auth state', async () => {
    const refreshUser = vi.fn().mockResolvedValue({
      ...mockUserWithImage,
      profileImageUrl: undefined,
    })
    vi.spyOn(apiClient, 'removeProfileImage').mockResolvedValue(undefined)

    renderProfilePage({
      ...createMockAuthForRole('EMPLOYEE'),
      user: mockUserWithImage,
      refreshUser,
    })

    await userEvent.click(screen.getByTestId('profile-image-remove-btn'))
    await userEvent.click(screen.getByTestId('profile-image-remove-confirm-btn'))

    await waitFor(() => {
      expect(apiClient.removeProfileImage).toHaveBeenCalledTimes(1)
      expect(refreshUser).toHaveBeenCalledTimes(1)
    })
  })

  it('[P1] renders initials when no profile image is present', () => {
    renderProfilePage({
      ...createMockAuthForRole('EMPLOYEE'),
      user: { ...mockUsers.employee, profileImageUrl: undefined },
    })

    expect(screen.getByTestId('profile-image-initials')).toHaveTextContent('SC')
  })

  it('[P1] uses a two-card profile layout with summary and image controls', () => {
    renderProfilePage(createMockAuthForRole('EMPLOYEE'))

    const layout = screen.getByTestId('profile-page').querySelector('.profile-layout')
    expect(layout).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Profile summary' })).toHaveClass('profile-summary-card')
    expect(screen.getByRole('region', { name: 'Profile photo' })).toHaveClass('profile-image-card')
    expect(screen.getByTestId('profile-image-input')).toBeInTheDocument()
  })

  it('[P1] renders null-safe profile fields for platform admin', () => {
    renderProfilePage(createMockAuthForRole('PLATFORM_ADMIN'))

    expect(screen.getByText('Riley Morgan')).toBeInTheDocument()
    expect(screen.getByText('Platform Admin')).toBeInTheDocument()
    expect(screen.getAllByText('Not applicable')).toHaveLength(2)
    expect(screen.getByText('Not set')).toBeInTheDocument()
  })

  it('[P2] shows localized preferred language label from i18n keys', () => {
    renderProfilePage({
      ...createMockAuthForRole('EMPLOYEE'),
      user: { ...mockUsers.employee, preferredLanguage: 'ar' },
    })

    expect(screen.getByText('العربية')).toBeInTheDocument()
  })
})
