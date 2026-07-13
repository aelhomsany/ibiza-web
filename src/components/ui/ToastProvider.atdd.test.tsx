import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import { useToast } from './toastContext'

const toastProviderModulePath = './ToastProvider'

describe('ToastProvider ATDD — Story 10.8', () => {
  test('[P0] owns one stable app toast that retains its success tone across navigation', async () => {
    // Remove .skip after ToastProvider exists. The dynamic import intentionally keeps the
    // red scaffold loadable before the new module is implemented.
    const { ToastProvider } = await import(/* @vite-ignore */ toastProviderModulePath)

    function Trigger() {
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
          <Trigger />
          <Routes>
            <Route path="/" element={<p>Dashboard</p>} />
            <Route path="/my-leaves" element={<p>My Leaves</p>} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Show toast' }))
    const toast = screen.getByTestId('app-toast')
    expect(toast).toHaveAttribute('data-tone', 'success')
    expect(screen.getAllByTestId('app-toast')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Go to My Leaves' }))
    expect(screen.getByTestId('app-toast')).toHaveTextContent('Leave request submitted')
  })

  test('[P0] exposes warning tone through the same root toast contract', async () => {
    const { ToastProvider } = await import(/* @vite-ignore */ toastProviderModulePath)

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
})
