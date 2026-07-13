import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from './ToastProvider'
import { useToast } from './toastContext'

function Trigger() {
  const { showToast } = useToast()
  return <button type="button" onClick={() => showToast('Saved')}>Show toast</button>
}

describe('ToastProvider', () => {
  it('mounts one app toast with the stable success contract', async () => {
    const user = userEvent.setup()
    render(<ToastProvider><Trigger /></ToastProvider>)

    await user.click(screen.getByRole('button', { name: 'Show toast' }))

    expect(screen.getAllByTestId('app-toast')).toHaveLength(1)
    expect(screen.getByTestId('app-toast')).toHaveAttribute('data-tone', 'success')
  })

  it('exposes warning tone through the same root toast contract', async () => {
    function WarningTrigger() {
      const { showToast } = useToast()
      return (
        <button type="button" onClick={() => showToast('Unable to approve request', 'warning')}>
          Show warning
        </button>
      )
    }

    const user = userEvent.setup()
    render(
      <ToastProvider>
        <WarningTrigger />
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Show warning' }))
    expect(screen.getByTestId('app-toast')).toHaveAttribute('data-tone', 'warning')
  })

  it('keeps the toast visible across route navigation', async () => {
    function NavTrigger() {
      const { showToast } = useToast()
      const navigate = useNavigate()
      return (
        <>
          <button type="button" onClick={() => showToast('Leave request submitted')}>
            Show toast
          </button>
          <button type="button" onClick={() => navigate('/my-leaves')}>
            Go to My Leaves
          </button>
        </>
      )
    }

    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <NavTrigger />
          <Routes>
            <Route path="/" element={<p>Dashboard</p>} />
            <Route path="/my-leaves" element={<p>My Leaves</p>} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Show toast' }))
    expect(screen.getByTestId('app-toast')).toHaveAttribute('data-tone', 'success')

    await user.click(screen.getByRole('button', { name: 'Go to My Leaves' }))
    expect(screen.getByTestId('app-toast')).toHaveTextContent('Leave request submitted')
  })
})
