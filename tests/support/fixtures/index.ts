import { test as base, mergeTests } from '@playwright/test'

import { UserFactory } from './factories/user-factory'

type TestFixtures = {
  userFactory: UserFactory
}

const factoryTest = base.extend<TestFixtures>({
  userFactory: async (_, run) => {
    const factory = new UserFactory()
    await run(factory)
    factory.cleanup()
  },
})

export const test = mergeTests(base, factoryTest)
export { expect } from '@playwright/test'
