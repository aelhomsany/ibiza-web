import type { ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from '../auth/useAuth'
import type { UserRole, UserSummaryResponse } from '../api/generated/types'

export const mockUsers = {
  employee: {
    id: 2,
    email: 'sarah@company.com',
    fullName: 'Sarah Chen',
    role: 'EMPLOYEE',
    organizationId: 1,
    timezone: 'America/New_York',
  },
  manager: {
    id: 1,
    email: 'alex@company.com',
    fullName: 'Alex Johnson',
    role: 'MANAGER',
    organizationId: 1,
    timezone: 'America/New_York',
  },
  hrAdmin: {
    id: 5,
    email: 'jordan@company.com',
    fullName: 'Jordan Lee',
    role: 'HR_ADMIN',
    organizationId: 1,
    timezone: 'America/New_York',
  },
  platformAdmin: {
    id: 99,
    email: 'admin@ibiza.app',
    fullName: 'Platform Admin',
    role: 'PLATFORM_ADMIN',
    organizationId: 1,
    timezone: 'UTC',
  },
} as const satisfies Record<string, UserSummaryResponse>

/** Legacy alias for mockUsers.employee. Prefer createMockAuthForRole in new tests. */
export const mockUser: UserSummaryResponse = mockUsers.employee

export function createMockAuthForRole(role: UserRole): AuthContextValue {
  const userByRole: Record<UserRole, UserSummaryResponse> = {
    EMPLOYEE: mockUsers.employee,
    MANAGER: mockUsers.manager,
    HR_ADMIN: mockUsers.hrAdmin,
    PLATFORM_ADMIN: mockUsers.platformAdmin,
  }

  return createMockAuthValue({ user: userByRole[role] })
}

export function createMockAuthValue(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn().mockResolvedValue(mockUser),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

type AuthTestProviderProps = {
  children: ReactNode
  value?: AuthContextValue
}

export function AuthTestProvider({
  children,
  value = createMockAuthValue(),
}: AuthTestProviderProps) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
