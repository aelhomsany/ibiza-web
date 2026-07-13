import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from './api/client'
import App from './App'

const appRouterMockState = vi.hoisted(() => ({
  shouldThrow: false,
}))

vi.mock('./api/client', () => ({
  getMe: vi.fn(),
  postLogin: vi.fn(),
  postLogout: vi.fn(),
  postRefresh: vi.fn(),
  setAuthFailureHandler: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

vi.mock('./routes/AppRouter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./routes/AppRouter')>()

  return {
    ...actual,
    AppRouter: () => {
      if (appRouterMockState.shouldThrow) {
        throw new Error('simulated shell render failure')
      }

      return actual.AppRouter()
    },
  }
})

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    appRouterMockState.shouldThrow = false
    vi.mocked(apiClient.postRefresh).mockRejectedValue(new Error('no session'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects unauthenticated users to the login page', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  it('catches shell-level render errors with a full-page recovery card', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    appRouterMockState.shouldThrow = true

    render(<App />)

    expect(screen.getByTestId('app-error-fallback')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.queryByTestId('org-shell')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-shell')).not.toBeInTheDocument()
  })
})
