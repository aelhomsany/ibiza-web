export type PublicPlanCode = 'FREE' | 'GROWTH' | 'CONTACT_SALES'

export type PublicCapability = {
  code: string
  label: string
  availability: 'AVAILABLE' | 'COMING_SOON' | 'CONTACT_SALES'
  presentation: 'INCLUDED' | 'PLANNED' | 'ASSISTED'
  checkoutEligible: boolean
}

export type PublicPlan = {
  code: PublicPlanCode
  name: string
  minimumActiveUsers: number
  maximumActiveUsers: number | null
  userBand: string
  monthlyPricePerActiveUserCents: number | null
  currency: 'USD' | null
  priceBasis: string
  cardRequired: boolean
  availability: 'SELF_SERVICE_WHEN_ENABLED' | 'ASSISTED'
  ctaLabel: string
  materialTerms: string[]
  capabilities: PublicCapability[]
}

export type PublicPlanCatalog = {
  intendedCount: number
  locale: 'en' | 'ar'
  recommendedPlan: PublicPlanCode
  registrationEnabled: boolean
  plans: PublicPlan[]
}

export type ContactSalesPayload = {
  companyName: string
  contactName: string
  contactEmail: string
  intendedCount: number
  country: string
  implementationContext: string
  followUpConsent: boolean
  turnstileToken: string
}

export type ContactSalesResult = {
  leadId: string
  workspaceCreated: false
  status: 'RECORDED' | 'QUALIFIED' | 'CLOSED'
}

export type RegistrationState = {
  registrationId: string
	status: 'VERIFICATION_PENDING' | 'VERIFIED' | 'CHECKOUT_PENDING' | 'PAYMENT_CONFIRMED'
		| 'PAID_PROVISIONING' | 'FREE_PROVISIONING' | 'ACTIVE' | 'EXPIRED'
		| 'ACTION_REQUIRED' | 'PROVISIONING_FAILED' | 'ABANDONED'
	selectedPlan: 'FREE' | 'GROWTH'
  intendedCount: number
  maskedEmail: string
  organizationName: string
  locale: 'en' | 'ar'
  country: string
  timezone: string
  safeReturnPath: string
  resendAvailableInSeconds: number
	workspaceCreated: boolean
	recoveryAction: 'WAIT_FOR_PAYMENT' | 'COMPLETE_PROVISIONING' | 'RETRY_PROVISIONING'
		| 'RESUME_CHECKOUT' | 'CHECK_EMAIL' | null
	checkoutSessionId: string | null
}

export type StartRegistrationPayload = {
	selectedPlan: 'FREE' | 'GROWTH'
  intendedCount: number
  administratorEmail: string
  organizationName: string
  locale: 'en' | 'ar'
  country: string
  timezone: string
  safeReturnPath: string
  termsVersion: string
  privacyVersion: string
  turnstileToken: string
}

export type ProvisionRegistrationPayload = {
  organizationDisplayName: string
  country: string
  timezone: string
  administratorFullName: string
  administratorPassword: string
  turnstileToken: string
}

export type ProvisionRegistrationResult = {
  organizationId: number
  creationSource: 'SELF_SERVICE'
	plan: 'FREE' | 'GROWTH'
  handoffCode: string
  handoffPath: string
  recovered: boolean
}

export class PublicApiError extends Error {
  readonly status: number
  readonly type: string | null

  constructor(
    status: number,
    type: string | null,
  ) {
    super('Public request was not accepted')
    this.status = status
    this.type = type
  }
}

function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL ?? ''
  return configured === 'http://localhost:8080' ? '' : configured
}

/**
 * `crypto.randomUUID` exists only in secure contexts, so it is undefined on any plain
 * `http://` staging or LAN origin. Calling it unguarded threw before `fetch` was even
 * reached, which surfaced to the visitor as a misleading "check your connection".
 */
export function publicUuid(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `pub-${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`
}

/** A stalled response must not leave the caller awaiting forever. */
const REQUEST_TIMEOUT_MS = 15_000

function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

async function requireJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { type?: string } | null
    throw new PublicApiError(response.status, problem?.type ?? null)
  }
  return response.json() as Promise<T>
}

export async function loadPublicPlans(
  intendedCount: number,
  locale: 'en' | 'ar',
  signal?: AbortSignal,
): Promise<PublicPlanCatalog> {
  const params = new URLSearchParams({
    intendedCount: String(intendedCount),
    locale,
  })
  const response = await fetch(`${apiBaseUrl()}/api/v1/public/plans?${params}`, {
    credentials: 'omit',
    headers: { Accept: 'application/json' },
    signal: withTimeout(signal),
  })
  return requireJson<PublicPlanCatalog>(response)
}

/**
 * The country the CDN in front of the API resolved for this request, or null when it did not say.
 *
 * Advisory only: it preselects a field the visitor can change, and the header behind it is
 * forgeable by anyone reaching the origin directly, so nothing may be authorised on it.
 */
export async function loadVisitorCountry(signal?: AbortSignal): Promise<string | null> {
  const response = await fetch(`${apiBaseUrl()}/api/v1/public/visitor-geo`, {
    credentials: 'omit',
    headers: { Accept: 'application/json' },
    signal: withTimeout(signal),
  })
  const body = await requireJson<{ country?: string | null }>(response)
  return body.country ?? null
}

export async function submitContactSales(
  payload: ContactSalesPayload,
  idempotencyKey: string,
): Promise<ContactSalesResult> {
  const response = await fetch(`${apiBaseUrl()}/api/v1/contact-sales`, {
    method: 'POST',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      'X-Correlation-Id': publicUuid(),
    },
    body: JSON.stringify(payload),
    signal: withTimeout(),
  })
  return requireJson<ContactSalesResult>(response)
}

async function registrationRequest<T>(
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Correlation-Id': publicUuid(),
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: withTimeout(),
  })
  return requireJson<T>(response)
}

export function startRegistration(payload: StartRegistrationPayload, idempotencyKey = publicUuid()) {
  return registrationRequest<RegistrationState>(
    '/api/v1/registrations', 'POST', payload, idempotencyKey,
  )
}

export function verifyRegistration(registrationId: string, token: string, idempotencyKey = publicUuid()) {
  return registrationRequest<RegistrationState>(
    `/api/v1/registrations/${encodeURIComponent(registrationId)}/verify`,
    'POST', { token }, idempotencyKey,
  )
}

export function resendRegistration(registrationId: string, turnstileToken: string, idempotencyKey = publicUuid()) {
  return registrationRequest<RegistrationState>(
    `/api/v1/registrations/${encodeURIComponent(registrationId)}/resend`,
    'POST', { turnstileToken }, idempotencyKey,
  )
}

export function loadRegistration(registrationId: string) {
  return registrationRequest<RegistrationState>(
    `/api/v1/registrations/${encodeURIComponent(registrationId)}`, 'GET',
  )
}

export function recoverRegistration(administratorEmail: string, idempotencyKey = publicUuid()) {
  return registrationRequest<{ status: string; nextAction: string }>(
    '/api/v1/registrations/recovery', 'POST', { administratorEmail }, idempotencyKey,
  )
}

export function provisionRegistration(
  registrationId: string,
  payload: ProvisionRegistrationPayload,
  idempotencyKey = publicUuid(),
) {
  return registrationRequest<ProvisionRegistrationResult>(
    `/api/v1/registrations/${encodeURIComponent(registrationId)}/provision`,
    'POST', payload, idempotencyKey,
  )
}

export type RegistrationCheckoutResult = {
	checkoutUrl: string
	checkoutSessionId: string
	status: 'CHECKOUT_PENDING'
}

export function startRegistrationCheckout(
	registrationId: string,
	selectedPlan: 'GROWTH',
	declaredQuantity: number,
	turnstileToken: string,
	idempotencyKey = publicUuid(),
) {
	return registrationRequest<RegistrationCheckoutResult>(
		`/api/v1/registrations/${encodeURIComponent(registrationId)}/checkout`,
		'POST', { selectedPlan, declaredQuantity, turnstileToken }, idempotencyKey,
	)
}
