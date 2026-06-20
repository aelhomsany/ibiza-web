import type {
  BalanceCardResponse,
  OutTodayResponse,
  RecentRequestResponse,
  UpcomingAbsenceResponse,
  CreateLeaveRequestRequest,
  CreatePublicHolidayRequest,
  CreateTeamMemberRequest,
  CreateWorkforceGroupRequest,
  DayOfWeek,
  ForgotPasswordRequest,
  LeaveRequestResponse,
  LeaveTypeResponse,
  LoginRequest,
  PendingApprovalResponse,
  PreviewLeaveRequestRequest,
  PreviewLeaveRequestResponse,
  ProblemDetail,
  PublicHolidayResponse,
  ResetPasswordRequest,
  TeamMemberDetailResponse,
  TeamMemberSummaryResponse,
  TokenResponse,
  UpdatePublicHolidayRequest,
  UpdateTeamMemberRequest,
  UpdateWeekendDaysRequest,
  UserSummaryResponse,
  WorkforceGroupResponse,
} from './generated/types'
import { clearAccessToken, getAccessToken, setAccessToken } from '../auth/tokenStorage'

/** Prefer relative /api paths so Vite dev proxy forwards cookies (refresh token). */
const configuredBaseUrl = import.meta.env.VITE_API_URL ?? ''
export const baseUrl =
  configuredBaseUrl === 'http://localhost:8080' ? '' : configuredBaseUrl

let authFailureHandler: (() => void) | null = null
let refreshPromise: Promise<TokenResponse> | null = null

export function setAuthFailureHandler(handler: (() => void) | null): void {
  authFailureHandler = handler
}

export class ApiError extends Error {
  readonly status: number
  readonly problem: ProblemDetail

  constructor(status: number, problem: ProblemDetail) {
    super(problem.detail ?? problem.title ?? 'Request failed')
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

function resolveUrl(path: string): string {
  if (path.startsWith('http')) {
    return path
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${normalizedPath}`
}

function createCorrelationId(): string {
  return crypto.randomUUID()
}

async function parseProblemDetail(response: Response): Promise<ProblemDetail> {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/problem+json') || contentType.includes('application/json')) {
    try {
      return (await response.json()) as ProblemDetail
    } catch {
      // fall through
    }
  }
  return {
    status: response.status,
    title: response.statusText,
    detail: response.statusText || 'Request failed',
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  skipAuthRefresh?: boolean
  _retried?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuthRefresh, _retried, headers: customHeaders, ...init } = options
  const headers = new Headers(customHeaders)
  headers.set('X-Correlation-Id', createCorrelationId())

  if (body !== undefined && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(resolveUrl(path), {
    ...init,
    headers,
    credentials: 'include',
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  })

  if (
    response.status === 401 &&
    !skipAuthRefresh &&
    !_retried &&
    !path.includes('/auth/login') &&
    !path.includes('/auth/refresh')
  ) {
    try {
      await refreshAccessToken()
      return request<T>(path, { ...options, _retried: true })
    } catch {
      authFailureHandler?.()
      throw new ApiError(401, {
        status: 401,
        detail: 'Session expired',
        title: 'Unauthorized',
      })
    }
  }

  if (response.status === 204) {
    return undefined as T
  }

  if (!response.ok) {
    const problem = await parseProblemDetail(response)
    throw new ApiError(response.status, problem)
  }

  if (response.headers.get('content-length') === '0') {
    return undefined as T
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) {
    return undefined as T
  }

  return (await response.json()) as T
}

async function refreshAccessToken(): Promise<TokenResponse> {
  if (!refreshPromise) {
    refreshPromise = postRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export async function postLogin(credentials: LoginRequest): Promise<TokenResponse> {
  const tokens = await request<TokenResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: credentials,
    skipAuthRefresh: true,
  })
  setAccessToken(tokens.accessToken)
  return tokens
}

export async function postRefresh(): Promise<TokenResponse> {
  const tokens = await request<TokenResponse>('/api/v1/auth/refresh', {
    method: 'POST',
    body: {},
    skipAuthRefresh: true,
  })
  setAccessToken(tokens.accessToken)
  return tokens
}

export async function postLogout(): Promise<void> {
  await request<void>('/api/v1/auth/logout', {
    method: 'POST',
    body: {},
    skipAuthRefresh: true,
  })
  clearAccessToken()
}

export async function getMe(): Promise<UserSummaryResponse> {
  return request<UserSummaryResponse>('/api/v1/auth/me', {
    method: 'GET',
  })
}

export async function postForgotPassword(payload: ForgotPasswordRequest): Promise<void> {
  await request<void>('/api/v1/auth/forgot-password', {
    method: 'POST',
    body: payload,
    skipAuthRefresh: true,
  })
}

export async function postResetPassword(payload: ResetPasswordRequest): Promise<void> {
  await request<void>('/api/v1/auth/reset-password', {
    method: 'POST',
    body: payload,
    skipAuthRefresh: true,
  })
}

export async function getWorkforceGroups(): Promise<WorkforceGroupResponse[]> {
  return request<WorkforceGroupResponse[]>('/api/v1/workforce-groups', {
    method: 'GET',
  })
}

export async function createWorkforceGroup(
  payload: CreateWorkforceGroupRequest,
): Promise<WorkforceGroupResponse> {
  return request<WorkforceGroupResponse>('/api/v1/workforce-groups', {
    method: 'POST',
    body: payload,
  })
}

export async function putWorkforceGroupWeekendDays(
  groupId: number,
  weekendDays: DayOfWeek[],
): Promise<WorkforceGroupResponse> {
  const payload: UpdateWeekendDaysRequest = { weekendDays }
  return request<WorkforceGroupResponse>(
    `/api/v1/workforce-groups/${groupId}/weekend-days`,
    {
      method: 'PUT',
      body: payload,
    },
  )
}

export async function getPublicHolidays(
  workforceGroupId: number,
): Promise<PublicHolidayResponse[]> {
  return request<PublicHolidayResponse[]>(
    `/api/v1/public-holidays?workforceGroupId=${workforceGroupId}`,
    { method: 'GET' },
  )
}

export async function createPublicHoliday(
  payload: CreatePublicHolidayRequest,
): Promise<PublicHolidayResponse> {
  return request<PublicHolidayResponse>('/api/v1/public-holidays', {
    method: 'POST',
    body: payload,
  })
}

export async function updatePublicHoliday(
  id: number,
  payload: UpdatePublicHolidayRequest,
): Promise<PublicHolidayResponse> {
  return request<PublicHolidayResponse>(`/api/v1/public-holidays/${id}`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function deletePublicHoliday(id: number): Promise<void> {
  return request<void>(`/api/v1/public-holidays/${id}`, {
    method: 'DELETE',
  })
}

export async function getLeaveTypes(): Promise<LeaveTypeResponse[]> {
  return request<LeaveTypeResponse[]>('/api/v1/leave-types', {
    method: 'GET',
  })
}

export async function previewLeaveRequest(
  payload: PreviewLeaveRequestRequest,
): Promise<PreviewLeaveRequestResponse> {
  return request<PreviewLeaveRequestResponse>('/api/v1/leave-requests/preview', {
    method: 'POST',
    body: payload,
  })
}

export async function createLeaveRequest(
  payload: CreateLeaveRequestRequest,
): Promise<LeaveRequestResponse> {
  return request<LeaveRequestResponse>('/api/v1/leave-requests', {
    method: 'POST',
    body: payload,
  })
}

export async function getDashboardBalances(): Promise<BalanceCardResponse[]> {
  return request<BalanceCardResponse[]>('/api/v1/dashboard/balances', {
    method: 'GET',
  })
}

export async function getDashboardRecentRequests(): Promise<RecentRequestResponse[]> {
  return request<RecentRequestResponse[]>('/api/v1/dashboard/recent-requests', {
    method: 'GET',
  })
}

export async function getMyLeaveRequests(): Promise<RecentRequestResponse[]> {
  return request<RecentRequestResponse[]>('/api/v1/leave-requests', {
    method: 'GET',
  })
}

export async function getPendingApprovals(): Promise<PendingApprovalResponse[]> {
  return request<PendingApprovalResponse[]>('/api/v1/approvals/pending', {
    method: 'GET',
  })
}

export async function getDashboardOutToday(): Promise<OutTodayResponse[]> {
  return request<OutTodayResponse[]>('/api/v1/dashboard/out-today', {
    method: 'GET',
  })
}

export async function getDashboardUpcoming(): Promise<UpcomingAbsenceResponse[]> {
  return request<UpcomingAbsenceResponse[]>('/api/v1/dashboard/upcoming', {
    method: 'GET',
  })
}

export async function getTeamMembers(): Promise<TeamMemberSummaryResponse[]> {
  return request<TeamMemberSummaryResponse[]>('/api/v1/team-members', {
    method: 'GET',
  })
}

export async function getTeamMember(id: number): Promise<TeamMemberDetailResponse> {
  return request<TeamMemberDetailResponse>(`/api/v1/team-members/${id}`, {
    method: 'GET',
  })
}

export async function createTeamMember(
  payload: CreateTeamMemberRequest,
): Promise<TeamMemberDetailResponse> {
  return request<TeamMemberDetailResponse>('/api/v1/team-members', {
    method: 'POST',
    body: payload,
  })
}

export async function updateTeamMember(
  id: number,
  payload: UpdateTeamMemberRequest,
): Promise<TeamMemberDetailResponse> {
  return request<TeamMemberDetailResponse>(`/api/v1/team-members/${id}`, {
    method: 'PATCH',
    body: payload,
  })
}

export const apiClient = {
  baseUrl,
  postLogin,
  postRefresh,
  postLogout,
  getMe,
  postForgotPassword,
  postResetPassword,
  getWorkforceGroups,
  createWorkforceGroup,
  putWorkforceGroupWeekendDays,
  getPublicHolidays,
  createPublicHoliday,
  updatePublicHoliday,
  deletePublicHoliday,
  getLeaveTypes,
  previewLeaveRequest,
  createLeaveRequest,
  getDashboardBalances,
  getDashboardRecentRequests,
  getMyLeaveRequests,
  getPendingApprovals,
  getDashboardOutToday,
  getDashboardUpcoming,
  getTeamMembers,
  getTeamMember,
  createTeamMember,
  updateTeamMember,
}
