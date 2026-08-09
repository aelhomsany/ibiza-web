import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearAccessToken, getAccessToken } from '../auth/tokenStorage'
import { ApiError, postAcceptInvitation } from './client'

describe('postAcceptInvitation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    clearAccessToken()
  })

  it('posts the invitation token and password without attempting an auth refresh', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 42, email: 'invitee@example.com' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      postAcceptInvitation({ token: 'invitation-token', password: 'StrongPass1!' }),
    ).resolves.toEqual(expect.objectContaining({ id: 42, email: 'invitee@example.com' }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/accept-invitation',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'invitation-token', password: 'StrongPass1!' }),
      }),
    )
    expect(getAccessToken()).toBeNull()
  })

  it('returns a 401 error without calling the refresh endpoint or retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'https://ibiza.app/errors/invitation-unavailable',
          title: 'Unauthorized',
          status: 401,
          detail: 'sensitive server detail',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/problem+json' },
        },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      postAcceptInvitation({ token: 'invitation-token', password: 'StrongPass1!' }),
    ).rejects.toBeInstanceOf(ApiError)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/auth/accept-invitation')
  })
})
