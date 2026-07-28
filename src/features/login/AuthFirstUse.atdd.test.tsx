/**
 * Story 11.7 — ATDD RED scaffolds for Auth and First-Use Product Polish.
 * Cover: auth-proof panel, mobile form-first DOM order, invalid-credential recovery
 * (email retained), HR-only first-use cue + Working calendars deep-link, localStorage
 * resume persistence.
 * Do NOT mirror Jakarta @Email / @NotBlank — API Auth*IntegrationTest remains authoritative.
 * Unskip each case during bmad-dev-story when the corresponding AC ships.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import * as apiClient from '../../api/client'
import type {
  BalanceCardResponse,
  RecentRequestResponse,
} from '../../api/generated/types'
import { ToastProvider } from '../../components/ui/ToastProvider'
import {
  AuthTestProvider,
  createMockAuthForRole,
  createMockAuthValue,
  mockUsers,
} from '../../test/authTestUtils'
import { DashboardPage } from '../dashboard/DashboardPage'
import { LoginPage } from './LoginPage'

const FIRST_USE_STORAGE_PREFIX = 'ibiza.firstUse.v1:'

const mockBalances: BalanceCardResponse[] = [
  {
    leaveTypeId: 1,
    name: 'Annual Leave',
    icon: 'leave',
    color: '#093C5D',
    backgroundColor: '#D6E8ED',
    borderColor: '#0E4F75',
    displayOrder: 1,
    capped: true,
    allocatedDays: 20,
    usedDays: 0,
    remainingDays: 20,
  },
]

const mockRequestHistory: RecentRequestResponse = {
  id: 101,
  leaveTypeId: 1,
  leaveTypeName: 'Annual Leave',
  leaveTypeIcon: 'leave',
  leaveTypeColor: '#093C5D',
  leaveTypeBackgroundColor: '#D6E8ED',
  leaveTypeBorderColor: '#0E4F75',
  dateFrom: '2026-06-01',
  dateTo: '2026-06-02',
  workingDays: 2,
  status: 'APPROVED',
  statusHint: 'Approved',
  declineReason: null,
  approverFirstName: 'Alex',
}

function renderLogin(login = vi.fn()) {
  return render(
    <MemoryRouter>
      <AuthTestProvider
        value={createMockAuthValue({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          login,
        })}
      >
        <LoginPage />
      </AuthTestProvider>
    </MemoryRouter>,
  )
}

/**
 * Org maturity is decided by org-scoped signals only (AC7): recent approval
 * decisions, public holidays, and active members with group assignments.
 * `emptyHistory` drives the caller's *personal* dashboard history, which must
 * never affect cue visibility — several tests rely on that independence.
 */
function stubDashboardApis(options?: {
  emptyHistory?: boolean
  noHolidays?: boolean
  noOrgLeaveHistory?: boolean
  unassignedMembers?: boolean
  soleMember?: boolean
}) {
  vi.spyOn(apiClient, 'getDashboardBalances').mockResolvedValue(mockBalances)
  vi.spyOn(apiClient, 'getDashboardRecentRequests').mockResolvedValue(
    options?.emptyHistory === false ? [mockRequestHistory] : [],
  )
  vi.spyOn(apiClient, 'getDashboardOutToday').mockResolvedValue([])
  vi.spyOn(apiClient, 'getDashboardUpcoming').mockResolvedValue([])
  vi.spyOn(apiClient, 'getPendingApprovalCount').mockResolvedValue({ count: 0 })
  vi.spyOn(apiClient, 'getRecentApprovalDecisions').mockResolvedValue(
    options?.noOrgLeaveHistory
      ? []
      : [
          {
            requestId: 501,
            employeeUserId: mockUsers.employee.id,
            employeeFullName: mockUsers.employee.fullName,
            leaveTypeId: 1,
            leaveTypeName: 'Annual Leave',
            dateFrom: '2026-06-01',
            dateTo: '2026-06-02',
            workingDays: 2,
            status: 'APPROVED',
            decidedAt: '2026-06-03T10:00:00Z',
          },
        ],
  )
  vi.spyOn(apiClient, 'getWorkforceGroups').mockResolvedValue([
    { id: 1, name: 'US', weekendDays: ['SATURDAY', 'SUNDAY'] },
  ])
  vi.spyOn(apiClient, 'getPublicHolidays').mockResolvedValue(
    options?.noHolidays
      ? []
      : [
          {
            id: 1,
            workforceGroupId: 1,
            dateFrom: '2026-06-19',
            dateTo: '2026-06-19',
            name: 'Juneteenth',
          },
        ],
  )
  vi.spyOn(apiClient, 'getTeamMembers').mockResolvedValue([
    {
      id: mockUsers.hrAdmin.id,
      fullName: mockUsers.hrAdmin.fullName,
      email: mockUsers.hrAdmin.email,
      department: 'People Ops',
      role: 'HR_ADMIN',
      workforceGroupId: options?.unassignedMembers ? null : 1,
      workforceGroupName: options?.unassignedMembers ? null : 'US',
      status: 'ACTIVE',
    },
    ...(options?.soleMember
      ? []
      : [
          {
            id: mockUsers.employee.id,
            fullName: mockUsers.employee.fullName,
            email: mockUsers.employee.email,
            department: 'Engineering',
            role: 'EMPLOYEE' as const,
            workforceGroupId: options?.unassignedMembers ? null : 1,
            workforceGroupName: options?.unassignedMembers ? null : 'US',
            status: 'ACTIVE' as const,
          },
        ]),
  ])
}

function SettingsDeepLinkStub() {
  const [params] = useSearchParams()
  return (
    <div
      data-testid="settings-page"
      data-category={params.get('category') ?? ''}
    >
      Settings
    </div>
  )
}

function renderDashboard(
  role: 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'PLATFORM_ADMIN',
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/']}>
          <AuthTestProvider value={createMockAuthForRole(role)}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/settings" element={<SettingsDeepLinkStub />} />
            </Routes>
          </AuthTestProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('AuthFirstUse ATDD — Story 11.7', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it(
    '[P0] Given desktop viewport, When /login renders, Then auth-proof panel and sign-in card are both present',
    async () => {
      renderLogin()

      expect(screen.getByTestId('login-page')).toBeInTheDocument()
      expect(screen.getByTestId('auth-proof-panel')).toBeInTheDocument()
      expect(screen.getByTestId('sign-in-submit')).toBeInTheDocument()
      expect(screen.getByTestId('auth-tenant-reassurance')).toBeInTheDocument()
    },
  )

  it(
    '[P0] Given viewport ≤900px, When /login renders, Then sign-in form precedes auth-proof in DOM without CSS reorder',
    async () => {
      renderLogin()

      const formControl = screen.getByTestId('sign-in-submit')
      const proof = screen.getByTestId('auth-proof-panel')
      const position = formControl.compareDocumentPosition(proof)
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

      // jsdom applies no stylesheet, so assert the source contract directly:
      // mobile order must come from DOM order, never from a CSS reorder.
      // Rendered visual order is covered by auth-first-use.spec.ts.
      const css = readFileSync(
        resolve(process.cwd(), 'src/features/login/auth-form.css'),
        'utf8',
      )
      const mobileBlock = css.slice(css.indexOf('@media (max-width: 900px)'))
      expect(mobileBlock).not.toMatch(/[\s;{]order\s*:/)
      expect(mobileBlock).not.toMatch(/row-reverse|column-reverse|wrap-reverse/)
      expect(mobileBlock).toMatch(/flex-direction:\s*column/)
    },
  )

  it(
    '[P0] Given invalid credentials, When sign-in fails, Then alert is shown and email is retained',
    async () => {
      const user = userEvent.setup()
      // Deliberately account-revealing server detail: the UI must map to its
      // own generic copy and never surface this, or sign-in leaks whether an
      // account exists. A test asserting the generic string alone would pass
      // even if the raw detail were rendered.
      const leakingDetail = 'No account found for alex@company.com'
      const login = vi.fn().mockRejectedValue(
        new ApiError(401, { status: 401, detail: leakingDetail }),
      )
      renderLogin(login)

      await user.type(screen.getByTestId('sign-in-email'), 'alex@company.com')
      await user.type(screen.getByTestId('sign-in-password'), 'wrong')
      await user.click(screen.getByTestId('sign-in-submit'))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Invalid email or password')
      expect(alert).not.toHaveTextContent(leakingDetail)
      expect(document.body.textContent).not.toContain('No account found')
      expect(screen.getByTestId('sign-in-email')).toHaveValue('alex@company.com')
    },
  )

  it(
    '[P0] Given HR_ADMIN with incomplete first-use, When Dashboard loads, Then three-step cue shows aria-current and text progress',
    async () => {
      stubDashboardApis({ noHolidays: true })
      localStorage.removeItem(
        `${FIRST_USE_STORAGE_PREFIX}${mockUsers.hrAdmin.organizationId}:${mockUsers.hrAdmin.id}`,
      )
      renderDashboard('HR_ADMIN')

      const cue = await screen.findByTestId('first-use-cue')
      expect(cue).toBeInTheDocument()
      expect(within(cue).getByText(/1 of 3/i)).toBeInTheDocument()
      expect(within(cue).getByRole('list')).toBeInTheDocument()
      expect(within(cue).getByTestId('first-use-step-1')).toHaveAttribute(
        'aria-current',
        'step',
      )
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
    },
  )

  it(
    '[P0] Given first-use cue CTA, When activated, Then navigates to /settings?category=working-calendars',
    async () => {
      const user = userEvent.setup()
      stubDashboardApis({ noHolidays: true })
      renderDashboard('HR_ADMIN')

      const cta = await screen.findByTestId('first-use-cta')
      await user.click(cta)

      const settings = await screen.findByTestId('settings-page')
      expect(settings).toHaveAttribute('data-category', 'working-calendars')
    },
  )

  it(
    '[P0] Given first-use progress saved, When Dashboard remounts, Then progress resumes from localStorage',
    async () => {
      stubDashboardApis({ noHolidays: true })
      const key = `${FIRST_USE_STORAGE_PREFIX}${mockUsers.hrAdmin.organizationId}:${mockUsers.hrAdmin.id}`
      localStorage.setItem(
        key,
        JSON.stringify({
          steps: { calendars: true, people: false, preview: false },
          updatedAt: '2026-07-27T00:00:00Z',
        }),
      )
      renderDashboard('HR_ADMIN')

      const cue = await screen.findByTestId('first-use-cue')
      expect(within(cue).getByText(/2 of 3/i)).toBeInTheDocument()
      expect(within(cue).getByTestId('first-use-step-2')).toHaveAttribute(
        'aria-current',
        'step',
      )
    },
  )

  it(
    '[P0] Given EMPLOYEE or MANAGER or PLATFORM_ADMIN, When Dashboard loads, Then first-use cue is absent',
    async () => {
      stubDashboardApis({ noHolidays: true })

      for (const role of ['EMPLOYEE', 'MANAGER', 'PLATFORM_ADMIN'] as const) {
        cleanup()
        renderDashboard(role)
        await screen.findByTestId('dashboard-page')
        expect(screen.queryByTestId('first-use-cue')).not.toBeInTheDocument()
      }
    },
  )

  it(
    '[P1] Given dismissed first-use progress, When Dashboard loads, Then cue is hidden and Dashboard remains usable',
    async () => {
      stubDashboardApis({ noHolidays: true })
      const key = `${FIRST_USE_STORAGE_PREFIX}${mockUsers.hrAdmin.organizationId}:${mockUsers.hrAdmin.id}`
      localStorage.setItem(
        key,
        JSON.stringify({
          steps: { calendars: false, people: false, preview: false },
          dismissed: true,
          updatedAt: '2026-07-27T00:00:00Z',
        }),
      )
      renderDashboard('HR_ADMIN')

      await screen.findByTestId('dashboard-page')
      expect(screen.queryByTestId('first-use-cue')).not.toBeInTheDocument()
      expect(screen.getByTestId('request-leave-btn')).toBeInTheDocument()
    },
  )

  it(
    '[P1] Given a mature organization, When HR Admin opens Dashboard, Then first-use cue does not nag',
    async () => {
      stubDashboardApis()
      renderDashboard('HR_ADMIN')

      await screen.findByTestId('dashboard-page')
      await waitFor(() => {
        expect(apiClient.getTeamMembers).toHaveBeenCalled()
        expect(apiClient.getPublicHolidays).toHaveBeenCalled()
      })
      expect(screen.queryByTestId('first-use-cue')).not.toBeInTheDocument()
      expect(screen.getByTestId('request-leave-btn')).toBeInTheDocument()
    },
  )

  it(
    '[P1] Given holidays and leave history but no group assignments, When HR Admin opens Dashboard, Then first-use cue still shows',
    async () => {
      stubDashboardApis({ unassignedMembers: true })
      renderDashboard('HR_ADMIN')

      // Org looks mature on every signal except group assignment, which is
      // exactly what step 2 exists to finish — it must not suppress the cue.
      expect(await screen.findByTestId('first-use-cue')).toBeInTheDocument()
    },
  )

  it(
    '[P1] Given a mature org and no personal leave history, When HR Admin opens Dashboard, Then cue stays suppressed',
    async () => {
      // A newly invited HR Admin has no requests of their own; suppression must
      // follow org-scoped signals, never the caller's personal history.
      stubDashboardApis({ emptyHistory: true })
      renderDashboard('HR_ADMIN')

      await screen.findByTestId('dashboard-page')
      await waitFor(() => {
        expect(apiClient.getRecentApprovalDecisions).toHaveBeenCalled()
      })
      expect(screen.queryByTestId('first-use-cue')).not.toBeInTheDocument()
    },
  )
})
