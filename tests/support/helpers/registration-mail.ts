import type { APIRequestContext } from '@playwright/test'

/**
 * Reads the registration link out of the local outbox, exactly as the administrator reads it out
 * of their inbox.
 *
 * <p>The raw verification token is deliberately never persisted — `RegistrationService` stores only
 * its SHA-256, and `RegistrationEmailSender` interpolates the raw value into the link and drops it.
 * So the mail body is the only place it exists, and an E2E that wants the real single-use link has
 * to read the mail. In dev the provider resolves to `LoggingEmailService`, which already keeps
 * every workflow email in memory; `DevMailSinkController` exposes that capture and refuses to exist
 * outside the dev/test/demo profiles with its property explicitly set.
 *
 * <p>The link is decomposed rather than followed verbatim: the API builds it from its own
 * configured public base URL, which need not be the port this Playwright run is using.
 */

const defaultApiUrl = process.env.API_URL ?? process.env.VITE_API_URL ?? 'http://localhost:8080'

export type CapturedEmail = { recipient: string; subject: string; body: string }
export type VerificationLink = { registrationId: string; token: string }

export async function capturedEmailsFor(
  request: APIRequestContext,
  recipient: string,
  apiUrl = defaultApiUrl,
): Promise<CapturedEmail[]> {
  const response = await request.fetch(
    `${apiUrl}/api/v1/dev/mail?recipient=${encodeURIComponent(recipient)}`,
    { method: 'GET' },
  )
  if (response.status() === 404) {
    throw new Error(
      'The dev mail sink is not enabled. Run through scripts/run-e2e-with-api.sh, which sets '
      + 'ibiza.dev-mail-sink.enabled; without it the raw verification token is unreachable.',
    )
  }
  if (!response.ok()) {
    throw new Error(`Dev mail sink returned ${response.status()}: ${await response.text()}`)
  }
  return (await response.json()) as CapturedEmail[]
}

/**
 * Waits for the verification email and returns the credentials embedded in its link. Emails are
 * dispatched after the owning transaction commits, so a short poll is expected, not a smell.
 */
export async function verificationLinkFor(
  request: APIRequestContext,
  recipient: string,
  options: { timeoutMs?: number; apiUrl?: string } = {},
): Promise<VerificationLink> {
  const timeoutMs = options.timeoutMs ?? 20_000
  const deadline = Date.now() + timeoutMs

  for (;;) {
    const emails = await capturedEmailsFor(request, recipient, options.apiUrl)
    for (const email of emails) {
      const match = /https?:\/\/\S*\/register\/verify\?\S+/.exec(email.body)
      if (!match) continue
      const url = new URL(match[0])
      const registrationId = url.searchParams.get('registrationId')
      const token = url.searchParams.get('token')
      if (registrationId && token) return { registrationId, token }
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `No verification link reached ${recipient} within ${timeoutMs}ms `
        + `(${emails.length} message(s) captured for that address).`,
      )
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

/**
 * Waits for the invitation a newly provisioned administrator receives and returns the raw
 * set-password token from its link.
 *
 * Same reasoning as the verification link above: `PasswordResetService.sendInvitation` persists
 * only the SHA-256 of the token and interpolates the raw value into `/reset-password?token=…`, so
 * the mail body is the only place it exists. A test that wants a genuine session for an invited
 * administrator has to read the mail, exactly as they would. Note this is the password-reset
 * invitation the PLATFORM provisioning path sends — not `/accept-invitation`, which is the
 * separate team-member invitation an HR Admin issues from Settings.
 */
export async function initialPasswordTokenFor(
  request: APIRequestContext,
  recipient: string,
  options: { timeoutMs?: number; apiUrl?: string } = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 20_000
  const deadline = Date.now() + timeoutMs

  for (;;) {
    const emails = await capturedEmailsFor(request, recipient, options.apiUrl)
    for (const email of emails) {
      const match = /https?:\/\/\S*\/reset-password\?\S+/.exec(email.body)
      if (!match) continue
      const token = new URL(match[0]).searchParams.get('token')
      if (token) return token
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `No invitation link reached ${recipient} within ${timeoutMs}ms `
        + `(${emails.length} message(s) captured for that address).`,
      )
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}
