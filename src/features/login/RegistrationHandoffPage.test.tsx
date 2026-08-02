import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as tokenStorage from '../../auth/tokenStorage'
import { RegistrationHandoffPage } from './RegistrationHandoffPage'

describe('RegistrationHandoffPage — Story 12.3', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    tokenStorage.clearAccessToken()
    window.history.replaceState({}, '', '/login/handoff?code=one-time-code')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    tokenStorage.clearAccessToken()
  })

  it('[P0] removes the handoff code from the URL before exchange and exposes recovery on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    render(<RegistrationHandoffPage />)

    expect(window.location.pathname).toBe('/login/handoff')
    expect(window.location.search).toBe('')
    expect(await screen.findByRole('heading', { name: /cannot be used/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Recover Registration/i })).toHaveAttribute(
      'href',
      '/register/recovery',
    )
    expect(tokenStorage.getAccessToken()).toBeNull()
  })

  it('[P0] stores the customer access token and navigates only to an allowlisted destination', async () => {
    const replace = vi.fn()
    vi.stubGlobal('location', {
      ...window.location,
      pathname: '/login/handoff',
      search: '?code=one-time-code',
      href: 'http://localhost/login/handoff?code=one-time-code',
      replace,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          accessToken: 'customer-jwt',
          safeReturnPath: 'https://evil.example/phish',
        }),
      }),
    )

    render(<RegistrationHandoffPage />)

    await waitFor(() => expect(tokenStorage.getAccessToken()).toBe('customer-jwt'))
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('[P0] preserves allowlisted Settings return path after a successful exchange', async () => {
    const replace = vi.fn()
    vi.stubGlobal('location', {
      ...window.location,
      pathname: '/login/handoff',
      search: '?code=one-time-code',
      href: 'http://localhost/login/handoff?code=one-time-code',
      replace,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          accessToken: 'customer-jwt',
          safeReturnPath: '/settings?category=working-calendars',
        }),
      }),
    )

    render(<RegistrationHandoffPage />)

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/settings?category=working-calendars'),
    )
  })
})
