import { describe, expect, it } from 'vitest'
import { ApiError } from './client'

describe('ApiError ATDD - Story 10.4', () => {
  it('[P1] exposes validation-failed field violations as a reusable field-error map', () => {
    const problem = {
      status: 400,
      title: 'Validation failed',
      detail: 'Request failed validation',
      type: 'https://ibiza.app/errors/validation-failed',
      violations: [
        { field: 'fullName', message: 'Full name is required' },
        { field: 'email', message: 'Email must be valid' },
      ],
    }

    const error = new ApiError(400, problem)

    expect(error.fieldViolations).toEqual({
      fullName: ['Full name is required'],
      email: ['Email must be valid'],
    })
  })
})
