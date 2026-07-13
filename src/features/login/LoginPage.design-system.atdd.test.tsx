import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthTestProvider, createMockAuthValue } from '../../test/authTestUtils'
import { LoginPage } from './LoginPage'

describe('LoginPage design-system ATDD — Story 10.6', () => {
  const login = vi.fn()

  beforeEach(() => {
    login.mockReset()
    login.mockResolvedValue({
      id: 1,
      email: 'alex@company.com',
      fullName: 'Alex Pilot',
      role: 'EMPLOYEE',
      organizationId: 1,
      timezone: 'America/New_York',
    })
  })

  it('[P1] sign-in submit uses btn btn-primary btn-block instead of auth-submit color block', () => {
    render(
      <MemoryRouter>
        <AuthTestProvider
          value={createMockAuthValue({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            login,
          })}
        >
          <LoginPage />
        </AuthTestProvider>
      </MemoryRouter>,
    )

    const submit = screen.getByTestId('sign-in-submit')
    expect(submit).toHaveClass('btn', 'btn-primary', 'btn-block')
    expect(submit).not.toHaveClass('auth-submit')
  })
})
