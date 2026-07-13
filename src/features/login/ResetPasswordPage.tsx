import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, postResetPassword } from '../../api/client'
import { UmbrellaIcon } from '../../components/ui/icons'
import './auth-form.css'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (!token) {
      setError('Password reset link is invalid or has expired.')
      return
    }

    setSubmitting(true)

    try {
      await postResetPassword({ token, newPassword: password })
      navigate('/login', { replace: true, state: { passwordReset: true } })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Unable to reset password. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page" data-testid="reset-password-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon" aria-hidden="true">
            <UmbrellaIcon size={34} />
          </div>
          <div className="auth-logo-title">Ibiza</div>
          <div className="auth-logo-sub">Team Leave Management</div>
        </div>

        <div className="auth-form-title">Choose a new password</div>

        {!token && (
          <div className="auth-error" role="alert">
            Password reset link is invalid or has expired.
          </div>
        )}

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-form-group">
            <label htmlFor="reset-password">New password</label>
            <input
              id="reset-password"
              data-testid="reset-password"
              className="auth-input"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={!token}
            />
          </div>

          <div className="auth-form-group">
            <label htmlFor="reset-password-confirm">Confirm password</label>
            <input
              id="reset-password-confirm"
              data-testid="reset-password-confirm"
              className="auth-input"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={!token}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            data-testid="reset-password-submit"
            disabled={submitting || !token}
          >
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <Link className="auth-link" to="/login">
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
