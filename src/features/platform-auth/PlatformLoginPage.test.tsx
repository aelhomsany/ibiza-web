/**
 * Story 12.1 coverage for the dedicated Platform Admin login page.
 * Cross-realm credential rejection is covered by the API isolation integration test
 * and public entry-boundary E2E suite.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { PlatformLoginPage } from './PlatformLoginPage'
import { PlatformAuthContext } from './usePlatformAuth'

describe('PlatformLoginPage — Story 12.1', () => {
  afterEach(() => {
    cleanup()
  })

  it(
    '[P0] Given /app-admin/login, When PlatformLoginPage renders, Then operator landmarks and no customer CTAs are present',
    () => {
      render(
        <MemoryRouter>
          <PlatformAuthContext.Provider
            value={{
              user: null,
              isAuthenticated: false,
              isLoading: false,
              login: async () => {
                throw new Error('not used')
              },
              logout: async () => undefined,
            }}
          >
            <PlatformLoginPage />
          </PlatformAuthContext.Provider>
        </MemoryRouter>,
      )

      expect(
        screen.getByRole('heading', { name: /Platform Admin/i }),
      ).toBeInTheDocument()
      expect(screen.getByText(/Operator access only/i)).toBeInTheDocument()

      expect(screen.getByTestId('platform-sign-in-email')).toBeInTheDocument()
      expect(screen.getByTestId('platform-sign-in-password')).toBeInTheDocument()
      expect(screen.getByTestId('platform-sign-in-submit')).toBeInTheDocument()

      expect(screen.queryByRole('link', { name: /Register/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /Start Free/i })).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: /forgot.?workspace/i }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /Start Free/i }),
      ).not.toBeInTheDocument()
    },
  )
})
