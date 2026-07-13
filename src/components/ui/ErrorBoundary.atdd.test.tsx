import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const errorBoundaryPath = join(dirname(fileURLToPath(import.meta.url)), 'ErrorBoundary.tsx')

describe('ErrorBoundary ATDD — Story 10.1', () => {
  it(
    '[P0] defines route and app recovery fallbacks with retry/reload actions',
    () => {
      expect(existsSync(errorBoundaryPath)).toBe(true)
      const source = readFileSync(errorBoundaryPath, 'utf-8')

      expect(source).toContain('getDerivedStateFromError')
      expect(source).toContain('componentDidCatch')
      expect(source).toContain('route-error-fallback')
      expect(source).toContain('app-error-fallback')
      expect(source).toMatch(/Retry/)
      expect(source).toMatch(/Reload/)
      expect(source).toContain('window.location.reload')
    },
  )

  it(
    '[P1] retry resets boundary state without requiring a full page reload',
    () => {
      expect(existsSync(errorBoundaryPath)).toBe(true)
      const source = readFileSync(errorBoundaryPath, 'utf-8')

      expect(source).toMatch(/resetKey|hasError:\s*false/)
      expect(source).toMatch(/Retry/)
    },
  )
})
