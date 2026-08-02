/**
 * Story 12.1 public artifact import and bootstrap boundary coverage.
 * Build-time artifact graph verification remains authoritative for emitted chunks.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const publicMainPath = resolve(process.cwd(), 'src/entries/public-main.tsx')
const publicAppPath = resolve(process.cwd(), 'src/apps/public/PublicApp.tsx')

describe('Public artifact boundaries — Story 12.1', () => {
  it(
    '[P0] Given the public entry module, When inspected, Then it must not import AuthProvider',
    () => {
      const publicMain = readFileSync(publicMainPath, 'utf8')
      const publicApp = readFileSync(publicAppPath, 'utf8')

      expect(publicMain).not.toMatch(/AuthProvider/)
      expect(publicApp).not.toMatch(/AuthProvider/)
      expect(publicMain).not.toMatch(/AuthContext/)
      expect(publicApp).not.toMatch(/AuthContext/)
      expect(publicMain).not.toMatch(/features\/login/)
      expect(publicApp).not.toMatch(/OrgShell|AdminShell/)
    },
  )

  it(
    '[P0] Given public bootstrap, When started, Then it must not call /api/v1/auth/refresh or /me',
    () => {
      const publicMain = readFileSync(publicMainPath, 'utf8')
      const publicApp = readFileSync(publicAppPath, 'utf8')
      const combined = `${publicMain}\n${publicApp}`

      expect(combined).not.toMatch(/\/api\/v1\/auth\/refresh/)
      expect(combined).not.toMatch(/\/api\/v1\/auth\/me/)
      expect(combined).not.toMatch(/auth\/refresh/)
      expect(combined).not.toMatch(/getMe\s*\(/)
      expect(combined).not.toMatch(/fetchMe\s*\(/)
      expect(combined.includes("'/me'") || combined.includes('"/me"') || combined.includes('`/me`')).toBe(
        false,
      )
    },
  )
})
