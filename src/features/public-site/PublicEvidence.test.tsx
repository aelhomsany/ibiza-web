/**
 * Story 12.1 working-day product-evidence semantics and reading-order coverage.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PublicEvidence } from './PublicEvidence'

describe('PublicEvidence — Story 12.1', () => {
  afterEach(() => {
    cleanup()
  })

  it(
    '[P1] Given working-day proof, When rendered, Then result → dates → policy → consequence sections are exposed',
    () => {
      render(<PublicEvidence />)

      const proof = screen.getByTestId('working-day-proof')
      expect(proof).toBeInTheDocument()

      const result = screen.getByTestId('proof-result')
      const dates = screen.getByTestId('proof-dates')
      const policy = screen.getByTestId('proof-policy')
      const consequence = screen.getByTestId('proof-consequence')

      expect(result).toBeInTheDocument()
      expect(dates).toBeInTheDocument()
      expect(policy).toBeInTheDocument()
      expect(consequence).toBeInTheDocument()

      expect(result.compareDocumentPosition(dates) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(dates.compareDocumentPosition(policy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(
        policy.compareDocumentPosition(consequence) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    },
  )
})
