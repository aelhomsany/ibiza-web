/**
 * Country preselection on the registration form: the edge's answer outranks the local guess,
 * and neither may cost the visitor their own choice.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as publicClient from '../../api/publicClient'
import { getBrowserTimezone } from '../../auth/timezone'
import { RegistrationFlow } from './RegistrationFlow'

vi.mock('../public-site/analyticsGateway', () => ({
  emitApprovedPublicEvent: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../auth/timezone', () => ({ getBrowserTimezone: vi.fn(() => 'Africa/Cairo') }))

function countryField() {
  return screen.getByTestId('register-country') as HTMLSelectElement
}

describe('Registration country preselection', () => {
  beforeEach(() => {
    vi.mocked(getBrowserTimezone).mockReturnValue('Africa/Cairo')
    window.history.replaceState({}, '', '/register?plan=FREE')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('[P1] takes the country the edge resolved over the local time-zone guess', async () => {
    // The machine is in Cairo but the request reached the edge from the UK — a VPN, or a
    // traveller. The address the request actually came from wins.
    vi.spyOn(publicClient, 'loadVisitorCountry').mockResolvedValue('GB')
    render(<RegistrationFlow locale="en" route="/register" />)

    await waitFor(() => expect(countryField().value).toBe('GB'))
  })

  it('[P1] keeps the time-zone guess when the edge has no answer', async () => {
    vi.spyOn(publicClient, 'loadVisitorCountry').mockResolvedValue(null)
    render(<RegistrationFlow locale="en" route="/register" />)

    await waitFor(() => expect(countryField().value).toBe('EG'))
  })

  it('[P1] keeps the time-zone guess when the lookup fails, and reports nothing', async () => {
    vi.spyOn(publicClient, 'loadVisitorCountry').mockRejectedValue(new Error('offline'))
    render(<RegistrationFlow locale="en" route="/register" />)

    await waitFor(() => expect(countryField().value).toBe('EG'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('[P1] never overwrites a country the visitor chose themselves', async () => {
    let resolveLookup: (value: string | null) => void = () => {}
    vi.spyOn(publicClient, 'loadVisitorCountry').mockReturnValue(
      new Promise<string | null>((resolve) => {
        resolveLookup = resolve
      }),
    )
    const user = userEvent.setup()
    render(<RegistrationFlow locale="en" route="/register" />)

    await user.selectOptions(countryField(), 'JP')
    resolveLookup('GB')

    await waitFor(() => expect(countryField().value).toBe('JP'))
  })
})
