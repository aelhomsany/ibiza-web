import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoadingState } from './LoadingState'

describe('LoadingState ATDD — Story 10.7 announced loading states', () => {
  it('[P0] exposes role=status and aria-busy for screen readers', () => {
    render(<LoadingState label="Loading team members" testId="team-members-loading" />)

    const status = screen.getByRole('status', { name: /loading team members/i })
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status).toHaveAttribute('data-testid', 'team-members-loading')
  })

  it('[P0] renders a visible or sr-only label for inline variant', () => {
    render(<LoadingState label="Loading pending requests" variant="inline" />)

    expect(screen.getByRole('status', { name: /loading pending requests/i })).toBeInTheDocument()
  })

  it('[P0] supports block variant without losing status semantics', () => {
    render(<LoadingState label="Loading leave history" variant="block" testId="my-leaves-history-loading" />)

    const status = screen.getByTestId('my-leaves-history-loading')
    expect(status).toHaveAttribute('role', 'status')
    expect(status).toHaveAttribute('aria-busy', 'true')
  })
})
