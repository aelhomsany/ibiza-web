import { test, expect } from '../support/fixtures'
import { tags } from '../support/tags'

test.describe('Password reset form', { tag: [tags.regression, tags.uiOnly] }, () => {
  test('Given the forgot-password page, When visiting, Then the form is visible', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByTestId('forgot-password-page')).toBeVisible()
    await expect(page.getByTestId('forgot-email')).toBeVisible()
  })
})

test.describe('Password reset submit', { tag: [tags.regression, tags.api] }, () => {
  test.skip(
    process.env.E2E_API_AVAILABLE !== 'true',
    'Set E2E_API_AVAILABLE=true when ibiza-api is running for forgot-password submit flow',
  )

  test('Given a known email, When submitting forgot-password, Then confirmation is shown', async ({
    page,
  }) => {
    await page.goto('/forgot-password')
    await page.getByTestId('forgot-email').fill(process.env.E2E_USER_EMAIL ?? 'alex@company.com')
    await page.getByRole('button', { name: 'Send reset link' }).click()

    await expect(
      page.getByText(/If an account exists for that email, you will receive reset instructions/i),
    ).toBeVisible()
  })
})
