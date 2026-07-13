import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./routes/AppRouter', () => ({
  AppRouter: () => {
    throw new Error('ATDD: simulated shell render failure')
  },
}))

describe('App top-level error boundary ATDD — Story 10.1', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  afterEach(() => {
    vi.restoreAllMocks()
    consoleErrorSpy?.mockRestore()
  })

  it(
    '[P0] catches shell-level render errors with a full-page recovery card instead of a blank screen',
    () => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<App />)

      expect(screen.getByTestId('app-error-fallback')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
      expect(screen.queryByTestId('org-shell')).not.toBeInTheDocument()
      expect(screen.queryByTestId('admin-shell')).not.toBeInTheDocument()
    },
  )
})
