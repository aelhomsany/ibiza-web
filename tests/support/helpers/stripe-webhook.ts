import { createHmac, randomUUID } from 'node:crypto'
import type { APIRequestContext } from '@playwright/test'

/**
 * Mints genuinely valid Stripe webhook signatures from the runner.
 *
 * <p>The paid E2E suites used to stub the whole API and explained themselves with "only a signed
 * provider webhook can produce these states, so no runner can seed them". That was never true. A
 * Stripe signature is HMAC-SHA256 over `"{unixSeconds}.{rawBody}"`, hex-encoded, sent as
 * `t=<ts>,v1=<hex>` — `StripeJavaGateway.verifyWebhookSignature` hands exactly that to
 * `com.stripe.net.Webhook.constructEvent`, and the API's own
 * `StripeWebhookTestSupport.signPayload` has been producing it against `whsec_test_secret` all
 * along. Nothing here is faked: the API verifies these signatures with the real Stripe library,
 * and rejects a body that was altered after signing.
 *
 * <p>The bytes posted are the bytes signed. Never re-serialize the event between signing and
 * sending — `JSON.stringify` is not stable across calls once key order or spacing changes, and a
 * one-byte difference is a signature failure that reads like a broken application.
 */

const defaultApiUrl = process.env.API_URL ?? process.env.VITE_API_URL ?? 'http://localhost:8080'
const WEBHOOK_PATH = '/api/v1/billing/stripe/webhook'

export type StripeEventPayload = {
  id: string
  object: 'event'
  type: string
  created: number
  data: { object: Record<string, unknown> }
}

function requireSecret(secret?: string): string {
  const resolved = secret ?? process.env.STRIPE_WEBHOOK_SECRET ?? ''
  if (!resolved) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET is not set. Run through scripts/run-e2e-with-api.sh, which exports it '
      + 'for both the API and the tests; signing with an empty secret produces a 400 that looks '
      + 'like a broken endpoint.',
    )
  }
  return resolved
}

/**
 * Builds a minimal but structurally real event.
 *
 * `created` is the *provider's* clock and is deliberately separate from the signature timestamp:
 * `StripeWebhookService` derives `graceEndsAt` from it, so back-dating `created` is how a test
 * reaches an expired grace period without touching any clock. The signature still carries a
 * current `t=`, so Stripe's five-minute replay tolerance keeps holding.
 */
export function stripeEvent(
  type: string,
  object: Record<string, unknown>,
  options: { id?: string; created?: Date } = {},
): StripeEventPayload {
  return {
    id: options.id ?? `evt_e2e_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
    object: 'event',
    type,
    created: Math.floor((options.created ?? new Date()).getTime() / 1000),
    data: { object },
  }
}

/** `t=<unixSeconds>,v1=<hex>` over `"{t}.{payload}"`, exactly as Stripe signs. */
export function signStripePayload(
  payload: string,
  options: { secret?: string; timestamp?: number } = {},
): string {
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000)
  const digest = createHmac('sha256', requireSecret(options.secret))
    .update(`${timestamp}.${payload}`)
    .digest('hex')
  return `t=${timestamp},v1=${digest}`
}

export type PostWebhookResult = { status: number; body: string }

/**
 * Posts one signed event and returns the raw outcome so a test can assert a rejection as
 * deliberately as an acceptance. `tamper` mutates the body *after* signing, which is the only
 * honest way to prove the signature is actually being checked.
 */
export async function postStripeWebhook(params: {
  request: APIRequestContext
  event: StripeEventPayload
  secret?: string
  timestamp?: number
  tamper?: (signedBody: string) => string
  apiUrl?: string
}): Promise<PostWebhookResult> {
  const { request, event, secret, timestamp, tamper, apiUrl = defaultApiUrl } = params
  const signedBody = JSON.stringify(event)
  const signature = signStripePayload(signedBody, { secret, timestamp })
  const sentBody = tamper ? tamper(signedBody) : signedBody

  const response = await request.fetch(`${apiUrl}${WEBHOOK_PATH}`, {
    method: 'POST',
    data: sentBody,
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature },
  })
  return { status: response.status(), body: await response.text() }
}

/** Posts and fails loudly on rejection — for the steps a test needs to have succeeded. */
export async function deliverStripeWebhook(
  params: Omit<Parameters<typeof postStripeWebhook>[0], 'tamper'>,
): Promise<void> {
  const { status, body } = await postStripeWebhook(params)
  if (status >= 300) {
    throw new Error(`Stripe webhook ${params.event.type} rejected with ${status}: ${body}`)
  }
}
