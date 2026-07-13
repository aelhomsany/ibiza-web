import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resets boundary state when Retry is clicked', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let shouldThrow = true

    function FlakyChild() {
      if (shouldThrow) {
        throw new Error('simulated render failure')
      }
      return <p>Recovered content</p>
    }

    render(
      <ErrorBoundary variant="route">
        <FlakyChild />
      </ErrorBoundary>,
    )

    expect(screen.getByTestId('route-error-fallback')).toBeInTheDocument()
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(screen.getByText('Recovered content')).toBeInTheDocument()
  })

  it('calls window.location.reload when Reload is clicked', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })

    function AlwaysThrows(): never {
      throw new Error('simulated render failure')
    }

    render(
      <ErrorBoundary variant="route">
        <AlwaysThrows />
      </ErrorBoundary>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))

    expect(reload).toHaveBeenCalledTimes(1)
  })
})
