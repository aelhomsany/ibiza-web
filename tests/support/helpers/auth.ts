import { expect, type APIRequestContext, type Page } from '@playwright/test'

import { apiRequest } from './api-client'

export type LoginCredentials = {
  email: string
  password: string
  timezone?: string
}

export type TokenResponse = {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
}

export async function loginViaApi(
  request: APIRequestContext,
  credentials: LoginCredentials,
): Promise<TokenResponse> {
  return apiRequest<TokenResponse>({
    request,
    method: 'POST',
    path: '/api/v1/auth/login',
    data: {
      email: credentials.email,
      password: credentials.password,
      // Africa/Cairo is what DemoScenarioSeeder gives the seeded demo accounts, and login
      // PERSISTS whatever timezone it is handed. A default that disagreed with the seed meant
      // every API sign-in rewrote that user's row as a side effect — mutating curated data the
      // caller did not intend to touch, and taking a row lock that deadlocked (MySQL 1213)
      // against concurrent sign-ins by the same account, surfacing as 500s from /auth/login.
      // Specs that are genuinely about timezone capture pass their own value; the behaviour
      // itself stays covered by AuthIntegrationTest#loginPersistsTimezoneAndReLoginOverwritesIt.
      timezone: credentials.timezone ?? 'Africa/Cairo',
    },
  })
}

/**
 * Platform Admin sign-in. Operators authenticate on their OWN realm: Story 12.1 separated the
 * chains so that customer credentials cannot establish a Platform Admin session and vice versa,
 * and `/api/v1/auth/login` answers 401 for an operator by design. Specs written before that split
 * still called loginViaApi for riley@leaveo.example and read the 401 as a broken fixture.
 */
export async function loginPlatformViaApi(
  request: APIRequestContext,
  credentials: { email: string; password: string },
): Promise<TokenResponse> {
  return apiRequest<TokenResponse>({
    request,
    method: 'POST',
    path: '/api/v1/platform-auth/login',
    data: { email: credentials.email, password: credentials.password },
  })
}

export async function loginViaUi(page: Page, credentials: LoginCredentials): Promise<void> {
  await page.goto('/login')
  await page.getByTestId('sign-in-email').fill(credentials.email)
  await page.getByTestId('sign-in-password').fill(credentials.password)
  await page.getByTestId('sign-in-submit').click()
  // Team Calendar leads the nav and is the post-login landing page since the
  // Dashboard merged into My Leaves (2026-09-01). nav-dashboard no longer renders,
  // so waiting on it here would time out every spec that signs in through the UI.
  await expect(page.getByTestId('nav-calendar')).toBeVisible()
}

export async function logoutViaUi(page: Page): Promise<void> {
  await page.getByTestId('user-menu-trigger').click()
  await page.getByTestId('user-menu-item-sign-out').click()
  await expect(page.getByTestId('login-page')).toBeVisible()
}

/** Client-side navigation — preserves in-memory auth (no full reload). */
export async function navigateInApp(page: Page, path: string): Promise<void> {
  await page.evaluate((targetPath) => {
    window.history.pushState({}, '', targetPath)
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
  }, path)
}

export const pilotCredentials: LoginCredentials = {
  email: process.env.E2E_USER_EMAIL ?? 'alex@company.com',
  password: process.env.E2E_USER_PASSWORD ?? 'PilotDev123!',
}
