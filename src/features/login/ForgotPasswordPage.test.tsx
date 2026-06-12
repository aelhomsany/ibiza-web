import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../api/client'
import { ForgotPasswordPage } from './ForgotPasswordPage'

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof apiClient>('../../api/client')
  return {
    ...actual,
    postForgotPassword: vi.fn(),
  }
})

describe('ForgotPasswordPage', () => {
  const postForgotPassword = vi.mocked(apiClient.postForgotPassword)

  beforeEach(() => {
    postForgotPassword.mockReset()
    postForgotPassword.mockResolvedValue(undefined)
  })

  it('renders forgot-password form test ids', () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('forgot-password-page')).toBeInTheDocument()
    expect(screen.getByTestId('forgot-email')).toBeInTheDocument()
  })

  it('Given a valid email, When submitting, Then shows confirmation message', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByTestId('forgot-email'), 'alex@company.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    await waitFor(() => {
      expect(
        screen.getByText(/If an account exists for that email, you will receive reset instructions/i),
      ).toBeInTheDocument()
    })
    expect(postForgotPassword).toHaveBeenCalledWith({ email: 'alex@company.com' })
  })
})
