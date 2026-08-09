import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthTestProvider, createMockAuthValue } from '../../test/authTestUtils'
import { CustomerRoutes } from './CustomerRouter'

describe('CustomerRoutes', () => {
  afterEach(() => {
    document.title = ''
  })

  it('keeps invitation acceptance outside auth guards in the deployed customer router', async () => {
    render(
      <MemoryRouter initialEntries={['/accept-invitation?token=customer-route-token']}>
        <AuthTestProvider
          value={createMockAuthValue({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          })}
        >
          <CustomerRoutes />
        </AuthTestProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('accept-invitation-page')).toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
    expect(document.title).toBe('Accept invitation — Ibiza')
  })
})
