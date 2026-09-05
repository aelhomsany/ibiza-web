import { render, screen, within } from '@testing-library/react'
import { vi } from 'vitest'
import {
  PlatformAuthContext,
  type PlatformAuthContextValue,
} from '../platform-auth/usePlatformAuth'
import { PlatformProfilePage } from './PlatformProfilePage'

function renderPage(overrides: Partial<PlatformAuthContextValue['user']> = {}) {
  const value: PlatformAuthContextValue = {
    user: {
      id: 1,
      email: 'riley@leaveo.example',
      fullName: 'Riley Morgan',
      role: 'PLATFORM_ADMIN',
      preferredLanguage: 'en',
      ...overrides,
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }
  render(
    <PlatformAuthContext.Provider value={value}>
      <PlatformProfilePage />
    </PlatformAuthContext.Provider>,
  )
}

describe('PlatformProfilePage', () => {
  it('[P1] shows platform identity without workforce group or timezone', () => {
    renderPage()

    expect(screen.getByTestId('platform-profile-name')).toHaveTextContent('Riley Morgan')
    expect(screen.getByTestId('platform-profile-email')).toHaveTextContent('riley@leaveo.example')
    expect(screen.getByTestId('platform-profile-role')).toHaveTextContent('Platform Admin')

    // Positive assertions first. i18n is configured with a parseMissingKeyHandler that
    // returns '', so a missing or renamed key renders blank -- the absence assertions
    // below would pass against an entirely empty <dl> without these.
    const fields = within(screen.getByTestId('platform-profile-list'))
    expect(fields.getByText('Name')).toBeInTheDocument()
    expect(fields.getByText('Operator email')).toBeInTheDocument()
    expect(fields.getByText('Access level')).toBeInTheDocument()
    expect(fields.getByText('Language')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Operator Profile' })).toBeInTheDocument()
    expect(screen.getByText(/Operator accounts are platform-scoped/)).toBeInTheDocument()

    // UX-DR28: the operator realm holds no organization-scoped data. Scoped to the field
    // list on purpose — the card's boundary copy mentions workforce groups to explain their absence.
    expect(fields.queryByText(/workforce group/i)).not.toBeInTheDocument()
    expect(fields.queryByText(/timezone/i)).not.toBeInTheDocument()
  })

  it('[P2] renders the not-set copy when no language preference exists', () => {
    renderPage({ preferredLanguage: null })

    expect(screen.getByTestId('platform-profile-language')).toHaveTextContent('Not set')
  })

  it('[P2] renders the resolved language name when a preference exists', () => {
    renderPage({ preferredLanguage: 'en' })

    expect(screen.getByTestId('platform-profile-language')).toHaveTextContent('English')
  })
})
