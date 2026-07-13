import { describe, expect, test } from 'vitest'

const queryClientModulePath = './queryClient'

describe('QueryClient defaults ATDD — Story 10.8', () => {
  test('[P0] creates every production client with one retry and a 30-second stale window', async () => {
    // Remove .skip once src/lib/queryClient.ts exists. @vite-ignore avoids resolving the
    // intentionally absent module during the red phase.
    const { createQueryClient } = await import(/* @vite-ignore */ queryClientModulePath)
    const queryClient = createQueryClient()
    const queries = queryClient.getDefaultOptions().queries

    expect(queries?.retry).toBe(1)
    expect(queries?.staleTime).toBe(30_000)
  })
})
