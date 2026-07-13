import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as apiClient from '../../api/client'
import { AuthTestProvider, createMockAuthValue, mockUsers } from '../../test/authTestUtils'
import { ToastProvider } from '../ui/ToastProvider'
import { LanguageSwitcher } from './LanguageSwitcher'

describe('LanguageSwitcher', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
  })

  it('applies Arabic immediately, updates document language attributes, and persists the preference', async () => {
    const refreshUser = vi.fn().mockResolvedValue({ ...mockUsers.employee, preferredLanguage: 'ar' })
    vi.spyOn(apiClient, 'updateUserPreferences').mockResolvedValue({
      ...mockUsers.employee,
      preferredLanguage: 'ar',
    })
    render(
      <ToastProvider>
        <AuthTestProvider value={createMockAuthValue({ refreshUser })}>
          <LanguageSwitcher />
        </AuthTestProvider>
      </ToastProvider>,
    )

    await userEvent.click(screen.getByTestId('language-switcher'))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'العربية' }))

    await waitFor(() => expect(apiClient.updateUserPreferences).toHaveBeenCalledWith({ preferredLanguage: 'ar' }))
    expect(document.documentElement).toHaveAttribute('lang', 'ar')
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
    expect(refreshUser).toHaveBeenCalled()
  })
})
