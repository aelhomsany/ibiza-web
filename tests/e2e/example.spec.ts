import { test, expect } from '../support/fixtures'
import { tags } from '../support/tags'

test.describe('Application shell', { tag: [tags.regression, tags.uiOnly] }, () => {
  test('Given an unauthenticated visitor, When visiting the home page, Then the login page is shown', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByTestId('login-page')).toBeVisible()
  })

  test('Given the user factory, When building a user, Then faker data is applied', async ({ userFactory }) => {
    const user = userFactory.build({ role: 'MANAGER' })
    expect(user.email).toContain('@')
    expect(user.role).toBe('MANAGER')
    expect(userFactory.getCreated()).toHaveLength(1)
  })
})
