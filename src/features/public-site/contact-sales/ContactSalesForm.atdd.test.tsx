import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContactSalesForm } from './ContactSalesForm'

/**
 * Story 12.2 SPA-only Contact Sales form guards (SALES-VAL-008, keyboard/recovery).
 * No Jakarta @NotBlank / @Email mirrors — API owns minimization + validation.
 */
describe('ContactSalesForm ATDD — Story 12.2', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('[P0] Given follow-up consent unchecked, When form is ready, Then submit stays blocked without claiming a workspace', () => {
    render(<ContactSalesForm />)
    expect(screen.getByTestId('contact-sales-follow-up-consent')).not.toBeChecked()
    expect(screen.getByTestId('contact-sales-submit')).toBeDisabled()
    expect(screen.queryByText(/workspace (was )?created/i)).not.toBeInTheDocument()
  })

  it('[P0] Given Contact Sales fields, When rendered, Then only approved fields exist and follow-up consent is distinct from analytics', () => {
    render(<ContactSalesForm />)
    for (const id of [
      'contact-sales-company',
      'contact-sales-email',
      'contact-sales-intended-count',
      'contact-sales-country',
      'contact-sales-context',
      'contact-sales-follow-up-consent',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument()
    }
    expect(screen.queryByTestId('contact-sales-leave-type')).not.toBeInTheDocument()
    expect(screen.queryByTestId('contact-sales-organization-id')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/analytics/i)).not.toBe(
      screen.getByTestId('contact-sales-follow-up-consent'),
    )
  })

  it('[P1] Given keyboard-only use, When Tab reaches follow-up consent and submit, Then Space/Enter can complete the path', async () => {
    const user = userEvent.setup()
    render(<ContactSalesForm initialIntendedCount={250} locale="en" />)

    await user.type(screen.getByTestId('contact-sales-company'), 'Acme Distributed')
    await user.type(screen.getByTestId('contact-sales-email'), 'pat@acme.example')
    await user.type(screen.getByTestId('contact-sales-country'), 'US')
    await user.type(screen.getByTestId('contact-sales-context'), 'Migration')

    await user.tab()
    let focused = document.activeElement?.getAttribute('data-testid')
    for (let i = 0; i < 20 && focused !== 'contact-sales-follow-up-consent'; i++) {
      await user.tab()
      focused = document.activeElement?.getAttribute('data-testid')
    }
    expect(focused).toBe('contact-sales-follow-up-consent')
    await user.keyboard(' ')
    expect(screen.getByTestId('contact-sales-follow-up-consent')).toBeChecked()
    expect(screen.getByTestId('contact-sales-submit')).toBeEnabled()
  })

  it('[P0] Given a recoverable provider failure, When the visitor retries, Then the same intent converges to an explicit no-workspace success', async () => {
    const user = userEvent.setup()
    const requestHeaders: string[] = []
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestHeaders.push(new Headers(init?.headers).get('Idempotency-Key') ?? '')
      if (requestHeaders.length === 1) {
        return new Response(
          JSON.stringify({ type: 'https://leaveo.net/errors/service-unavailable' }),
          { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
        )
      }
      return new Response(
        JSON.stringify({
          leadId: '8c9c90ab-1be5-45d9-ac58-8878a9be6eef',
          workspaceCreated: false,
          status: 'RECORDED',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ContactSalesForm initialIntendedCount={250} locale="en" />)

    await user.type(screen.getByTestId('contact-sales-company'), 'Acme Distributed')
    await user.type(screen.getByTestId('contact-sales-contact-name'), 'Pat Lee')
    await user.type(screen.getByTestId('contact-sales-email'), 'pat@acme.example')
    await user.type(screen.getByTestId('contact-sales-country'), 'US')
    await user.type(screen.getByTestId('contact-sales-context'), 'Need migration help')
    await user.click(screen.getByTestId('contact-sales-follow-up-consent'))
    await user.click(screen.getByTestId('contact-sales-submit'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/temporarily unavailable/i)
    await user.click(screen.getByTestId('contact-sales-submit'))

    expect(await screen.findByTestId('contact-sales-success')).toBeVisible()
    expect(screen.getByTestId('contact-sales-no-workspace')).toHaveTextContent(
      'No workspace was created.',
    )
    expect(requestHeaders).toHaveLength(2)
    expect(requestHeaders[1]).toBe(requestHeaders[0])
  })

  it('[P1] Given a 409 on a corrected resubmit, When the visitor submits again, Then a fresh Idempotency-Key is minted so the lead can still be recorded', async () => {
    const user = userEvent.setup()
    const requestKeys: string[] = []
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestKeys.push(new Headers(init?.headers).get('Idempotency-Key') ?? '')
      if (requestKeys.length === 1) {
        // The lead was recorded but the response was lost; the corrected payload now
        // collides with the stored fingerprint under the same key.
        return new Response(
          JSON.stringify({ type: 'https://leaveo.net/errors/conflict' }),
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
        )
      }
      return new Response(
        JSON.stringify({
          leadId: 'f1d2a1c7-9a1e-4f7e-9a1e-2b7c4d5e6f70',
          workspaceCreated: false,
          status: 'RECORDED',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ContactSalesForm initialIntendedCount={250} locale="en" />)

    await user.type(screen.getByTestId('contact-sales-company'), 'Acme Distributed')
    await user.type(screen.getByTestId('contact-sales-contact-name'), 'Pat Lee')
    await user.type(screen.getByTestId('contact-sales-email'), 'pat@acme.example')
    await user.type(screen.getByTestId('contact-sales-country'), 'US')
    await user.type(screen.getByTestId('contact-sales-context'), 'Need migration help')
    await user.click(screen.getByTestId('contact-sales-follow-up-consent'))
    await user.click(screen.getByTestId('contact-sales-submit'))

    const alert = await screen.findByRole('alert')
    expect(alert).toBeVisible()
    // The error summary takes focus, not just an aria announcement.
    expect(document.activeElement).toBe(alert)

    await user.click(screen.getByTestId('contact-sales-submit'))

    expect(await screen.findByTestId('contact-sales-success')).toBeVisible()
    expect(requestKeys).toHaveLength(2)
    expect(requestKeys[1]).not.toBe(requestKeys[0])
    expect(requestKeys[1]).toBeTruthy()
  })
})
