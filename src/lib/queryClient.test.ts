import { describe, expect, it } from 'vitest'
import { createQueryClient } from './queryClient'

describe('createQueryClient', () => {
  it('uses one retry and a 30-second stale window for queries', () => {
    const queries = createQueryClient().getDefaultOptions().queries

    expect(queries?.retry).toBe(1)
    expect(queries?.staleTime).toBe(30_000)
  })
})
