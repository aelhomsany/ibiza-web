import { faker } from '@faker-js/faker'

export type TestUser = {
  email: string
  fullName: string
  role: 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN'
  timezone: string
}

export class UserFactory {
  private readonly created: TestUser[] = []

  build(overrides: Partial<TestUser> = {}): TestUser {
    const user: TestUser = {
      email: faker.internet.email().toLowerCase(),
      fullName: faker.person.fullName(),
      role: 'EMPLOYEE',
      timezone: 'America/New_York',
      ...overrides,
    }
    this.created.push(user)
    return user
  }

  getCreated(): readonly TestUser[] {
    return this.created
  }

  cleanup(): void {
    this.created.length = 0
  }
}
