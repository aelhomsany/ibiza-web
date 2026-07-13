import { test, expect } from '../support/fixtures'
import { tags } from '../support/tags'

test.describe('Auth validation — critical UX blocks', { tag: [tags.regression, tags.uiOnly] }, () => {
  test('[P2] Given no reset token, When visiting reset-password, Then submit is disabled and error is shown', async ({
    page,
  }) => {
    await page.goto('/reset-password')

    await expect(page.getByTestId('reset-password-page')).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(
      'Password reset link is invalid or has expired.',
    )
    await expect(page.getByTestId('reset-password-submit')).toBeDisabled()
    await expect(page.getByTestId('reset-password')).toBeDisabled()
  })

  test('[P2] Given mismatched passwords, When submitting reset form, Then validation error is shown', async ({
    page,
  }) => {
    await page.goto('/reset-password?token=test-token')

    await page.getByTestId('reset-password').fill('NewPassword1!')
    await page.getByTestId('reset-password-confirm').fill('Different1!')
    await page.getByTestId('reset-password-submit').click()

    await expect(page.getByRole('alert')).toContainText('Passwords do not match.')
  })
})
