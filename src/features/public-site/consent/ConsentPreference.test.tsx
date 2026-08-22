/**
 * Story 12.1 consent-preference coverage.
 * API analytics policy tests remain authoritative for event and payload allowlists.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConsentPreference } from './ConsentPreference'
import {
  CONSENT_POLICY_VERSION,
  clearStoredConsent,
  persistConsent,
} from './publicConsent'

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

  it(
    '[P1] Given accepted analytics, When the stored consent is cleared because the server refused it, Then the prompt returns without a reload',
    async () => {
      persistConsent({
        policyVersion: CONSENT_POLICY_VERSION,
        analytics: 'ACCEPTED',
        receiptId: 'receipt-1',
        subject: 'a'.repeat(64),
        recordedAt: '2026-08-22T00:00:00.000Z',
      })
      render(<ConsentPreference />)
      await waitFor(() =>
        expect(screen.getByTestId('consent-accept-analytics')).toHaveAttribute(
          'aria-pressed',
          'true',
        ),
      )

      clearStoredConsent()

      // Back to the safe default, so the visitor is never told analytics are being
      // collected while the server is refusing every event.
      await waitFor(() =>
        expect(screen.getByTestId('consent-necessary')).toHaveAttribute(
          'aria-pressed',
          'true',
        ),
      )
      expect(screen.getByTestId('consent-accept-analytics')).not.toHaveAttribute(
        'aria-pressed',
        'true',
      )
    },
  )
})
