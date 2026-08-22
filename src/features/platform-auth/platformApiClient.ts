import type {
  ContactSalesLeadSummaryResponse,
  CreateOrganizationRequest,
  OrganizationSummaryResponse,
  UpdateSubscriptionRequest,
} from '../../api/generated/types'
import {
  clearPlatformAccessToken,
  getPlatformAccessToken,
  setPlatformAccessToken,
} from './platformTokenStorage'

export type PlatformAdminSummary = {
  id: number
  email: string
  fullName: string
  role: 'PLATFORM_ADMIN'
  preferredLanguage?: 'en' | 'ar' | null
}

type TokenResponse = {
  accessToken: string
  refreshToken: string
  tokenType?: string
  expiresIn?: number
}

type ProblemDetail = {
  type?: string
  title?: string
  status?: number
  detail?: string
}

const configuredBaseUrl = import.meta.env.VITE_API_URL ?? ''
const baseUrl = configuredBaseUrl === 'http://localhost:8080' ? '' : configuredBaseUrl
let authFailureHandler: (() => void) | null = null
let refreshPromise: Promise<TokenResponse> | null = null

export class PlatformApiError extends Error {
  readonly status: number
  readonly problem: ProblemDetail

  constructor(status: number, problem: ProblemDetail) {
    super(problem.detail ?? problem.title ?? 'Operator request failed')
    this.name = 'PlatformApiError'
    this.status = status
    this.problem = problem
  }
}

export function setPlatformAuthFailureHandler(handler: (() => void) | null) {
  authFailureHandler = handler
}

function assertPlatformPath(path: string) {
  if (
    !path.startsWith('/api/v1/platform-auth/') &&
    !path.startsWith('/api/v1/platform/')
  ) {
    throw new Error('Platform client refused a non-platform API path')
  }
}

async function parseProblem(response: Response): Promise<ProblemDetail> {
  try {
    return (await response.json()) as ProblemDetail
  } catch {
    return {
      status: response.status,
      title: response.statusText,
      detail: response.statusText,
    }
  }
}

async function request<T>(
  path: string,
  options: Omit<RequestInit, 'body'> & {
    body?: unknown
    skipRefresh?: boolean
    retried?: boolean
  } = {},
): Promise<T> {
  assertPlatformPath(path)
  const { body, skipRefresh, retried, headers: customHeaders, ...init } = options
  const headers = new Headers(customHeaders)
  headers.set('X-Correlation-Id', crypto.randomUUID())
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  const token = getPlatformAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (
    response.status === 401 &&
    !skipRefresh &&
    !retried &&
    !path.includes('/platform-auth/login') &&
    !path.includes('/platform-auth/refresh')
  ) {
    try {
      await refreshPlatformAccessToken()
      return request<T>(path, { ...options, retried: true })
    } catch {
      authFailureHandler?.()
      throw new PlatformApiError(401, {
        title: 'Unauthorized',
        detail: 'Operator session expired',
      })
    }
  }
  if (response.status === 204) return undefined as T
  if (!response.ok) throw new PlatformApiError(response.status, await parseProblem(response))
  return (await response.json()) as T
}

async function refreshPlatformAccessToken() {
  if (!refreshPromise) {
    refreshPromise = postPlatformRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export async function postPlatformLogin(email: string, password: string) {
  const response = await request<TokenResponse>('/api/v1/platform-auth/login', {
    method: 'POST',
    body: { email, password },
    skipRefresh: true,
  })
  setPlatformAccessToken(response.accessToken)
  return response
}

export async function postPlatformRefresh() {
  const response = await request<TokenResponse>('/api/v1/platform-auth/refresh', {
    method: 'POST',
    body: {},
    skipRefresh: true,
  })
  setPlatformAccessToken(response.accessToken)
  return response
}

export async function postPlatformLogout() {
  await request<void>('/api/v1/platform-auth/logout', {
    method: 'POST',
    body: {},
    skipRefresh: true,
  })
  clearPlatformAccessToken()
}

export async function getPlatformMe() {
  return request<PlatformAdminSummary>('/api/v1/platform-auth/me', { method: 'GET' })
}

export async function getPlatformOrganizations(): Promise<OrganizationSummaryResponse[]> {
  return request('/api/v1/platform/organizations', { method: 'GET' })
}

/**
 * Contact Sales leads the operator can still link. The server excludes leads already bound to an
 * Organization, so this list is never an invitation to trigger the create endpoint's 409.
 */
export async function getPlatformContactSalesLeads(): Promise<ContactSalesLeadSummaryResponse[]> {
  return request('/api/v1/platform/contact-sales-leads', { method: 'GET' })
}

export async function createPlatformOrganization(
  payload: CreateOrganizationRequest,
): Promise<OrganizationSummaryResponse> {
  return request('/api/v1/platform/organizations', { method: 'POST', body: payload })
}

export async function updatePlatformOrganizationSubscription(
  organizationId: number,
  payload: UpdateSubscriptionRequest,
): Promise<OrganizationSummaryResponse> {
  return request(`/api/v1/platform/organizations/${organizationId}/subscription`, {
    method: 'PATCH',
    body: payload,
  })
}

export type RecoverablePaidRegistration = {
  registrationId: string
  status: 'PAYMENT_CONFIRMED' | 'PROVISIONING_FAILED'
  plan: 'STARTER' | 'GROWTH'
  organizationName: string
  maskedAdministratorEmail: string
  updatedAt: string
}

export function getRecoverablePaidRegistrations(): Promise<RecoverablePaidRegistration[]> {
  return request('/api/v1/platform/registrations/recoverable', { method: 'GET' })
}

export function recoverPaidRegistration(registrationId: string): Promise<{
  organizationId: number
  plan: string
  creationSource: 'SELF_SERVICE'
  recovered: boolean
}> {
  return request(`/api/v1/platform/registrations/${encodeURIComponent(registrationId)}/recover-provisioning`, {
    method: 'POST',
  })
}

export const platformApiClient = {
  getPlatformOrganizations,
  createPlatformOrganization,
  updatePlatformOrganizationSubscription,
  getRecoverablePaidRegistrations,
  recoverPaidRegistration,
}
