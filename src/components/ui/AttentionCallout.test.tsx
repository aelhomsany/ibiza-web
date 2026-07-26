import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { AttentionCallout } from './AttentionCallout'

describe('AttentionCallout', () => {
  it('[P0] exposes one named priority task with one route action', () => {
    render(
      <MemoryRouter>
        <AttentionCallout
          eyebrow="Your next step"
          title="3 pending approvals"
          description="A decision keeps team plans current."
          actionLabel="Review Now"
          actionTo="/approvals"
          count={3}
          tone="priority"
        />
      </MemoryRouter>,
    )

    const region = screen.getByRole('region', {
      name: '3 pending approvals',
    })
    expect(region).toHaveTextContent('A decision keeps team plans current.')
    expect(screen.getByText('3', { selector: '.attention-callout-count' }))
      .toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review Now' })).toHaveAttribute(
      'href',
      '/approvals',
    )
    expect(region.querySelectorAll('a, button')).toHaveLength(1)
  })

  it('[P1] invokes the single callback action for a calm state', async () => {
    const onAction = vi.fn()
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AttentionCallout
          eyebrow="Your next step"
          title="Nothing needs your attention"
          description="Your leave plan is up to date."
          actionLabel="Request Leave"
          onAction={onAction}
        />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Request Leave' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})
