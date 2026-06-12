import { expect, type APIRequestContext, type Page } from '@playwright/test'

import { apiRequest } from './api-client'

export type LoginCredentials = {
  email: string
  password: string
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
    data: credentials,
  })
}

export async function loginViaUi(page: Page, credentials: LoginCredentials): Promise<void> {
  await page.goto('/login')
  await page.getByTestId('sign-in-email').fill(credentials.email)
  await page.getByTestId('sign-in-password').fill(credentials.password)
  await page.getByTestId('sign-in-submit').click()
  await expect(page.getByTestId('nav-dashboard')).toBeVisible()
}

export async function logoutViaUi(page: Page): Promise<void> {
  await page.getByTestId('sign-out-button').click()
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
