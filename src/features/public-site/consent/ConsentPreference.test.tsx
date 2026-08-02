/**
 * Story 12.1 consent-preference coverage.
 * API analytics policy tests remain authoritative for event and payload allowlists.
 */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConsentPreference } from './ConsentPreference'

describe('ConsentPreference — Story 12.1', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it(
    '[P0] Given unknown consent, When ConsentPreference renders, Then Necessary Only is the safe default',
    () => {
      render(<ConsentPreference />)

      const necessary = screen.getByTestId('consent-necessary')
      expect(necessary).toBeInTheDocument()
      expect(necessary).toHaveAttribute('aria-pressed', 'true')
      expect(screen.queryByTestId('consent-accept-analytics')).not.toHaveAttribute(
        'aria-pressed',
        'true',
      )
    },
  )

  it(
    '[P0] Given consent choices, When rendered, Then Accept Analytics and Necessary Only have equal presence',
    () => {
      render(<ConsentPreference />)

      const necessary = screen.getByTestId('consent-necessary')
      const accept = screen.getByTestId('consent-accept-analytics')
      expect(necessary).toBeInTheDocument()
      expect(accept).toBeInTheDocument()
      expect(necessary.tagName).toBe(accept.tagName)
      expect(necessary.getAttribute('type')).toBe(accept.getAttribute('type'))
    },
  )

  it(
    '[P0] Given Necessary Only chosen, When preference is saved, Then analytics emit helper is not called',
    async () => {
      const user = userEvent.setup()
      const emitAnalytics = vi.fn()
      render(<ConsentPreference onEmitAnalytics={emitAnalytics} />)

      await user.click(screen.getByTestId('consent-necessary'))
      expect(emitAnalytics).not.toHaveBeenCalled()
    },
  )
})
