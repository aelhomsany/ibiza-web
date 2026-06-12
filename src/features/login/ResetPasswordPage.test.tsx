import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ResetPasswordPage } from './ResetPasswordPage'

vi.mock('../../api/client', () => ({
  postResetPassword: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

function renderResetPage(token: string | null = 'valid-token') {
  const path = token ? `/reset-password?token=${token}` : '/reset-password'
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ResetPasswordPage', () => {
  it('renders reset form test ids when token is present', () => {
    renderResetPage()

    expect(screen.getByTestId('reset-password-page')).toBeInTheDocument()
    expect(screen.getByTestId('reset-password')).toBeInTheDocument()
    expect(screen.getByTestId('reset-password-confirm')).toBeInTheDocument()
    expect(screen.getByTestId('reset-password-submit')).toBeInTheDocument()
  })

  it('Given mismatched passwords, When submitting, Then shows validation error', async () => {
    const user = userEvent.setup()
    renderResetPage()

    await user.type(screen.getByTestId('reset-password'), 'NewPassword1!')
    await user.type(screen.getByTestId('reset-password-confirm'), 'Different1!')
    await user.click(screen.getByTestId('reset-password-submit'))

    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.')
  })

  it('Given no token in URL, When page loads, Then shows invalid link error', () => {
    renderResetPage(null)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Password reset link is invalid or has expired.',
    )
    expect(screen.getByTestId('reset-password-submit')).toBeDisabled()
  })
})
