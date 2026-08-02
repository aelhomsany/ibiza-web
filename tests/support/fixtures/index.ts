import { test as base, mergeTests } from '@playwright/test'

import { UserFactory } from './factories/user-factory'

type TestFixtures = {
  userFactory: UserFactory
}

const factoryTest = base.extend<TestFixtures>({
  // Playwright requires an object destructuring pattern for fixture dependencies.
  // eslint-disable-next-line no-empty-pattern
  userFactory: async ({}, provide) => {
    const factory = new UserFactory()
    await provide(factory)
    factory.cleanup()
  },
})

export const test = mergeTests(base, factoryTest)
export { expect } from '@playwright/test'
