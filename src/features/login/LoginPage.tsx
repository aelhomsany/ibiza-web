import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { getHomePath, getSafeRedirectPath } from '../../auth/authUtils'
import { useAuth } from '../../auth/useAuth'
import { UmbrellaIcon } from '../../components/ui/icons'
import './auth-form.css'

export function LoginPage() {
  const { login, isAuthenticated, isLoading, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!isLoading && isAuthenticated && user) {
    const fromPath = getSafeRedirectPath(
      (location.state as { from?: { pathname?: string } } | null)?.from?.pathname,
    )
    const destination = fromPath ?? getHomePath(user.role)
    return <Navigate to={destination} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const signedInUser = await login(email.trim(), password)
      const fromPath = getSafeRedirectPath(
        (location.state as { from?: { pathname?: string } } | null)?.from?.pathname,
      )
      navigate(fromPath ?? getHomePath(signedInUser.role), { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError('Too many attempts. Please try again shortly.')
        } else {
          setError(err.message)
        }
      } else {
        setError('Unable to sign in. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return <div className="auth-loading">Loading…</div>
  }

  return (
    <div className="auth-page" data-testid="login-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon" aria-hidden="true">
            <UmbrellaIcon size={34} />
          </div>
          <div className="auth-logo-title">Ibiza</div>
          <div className="auth-logo-sub">Team Leave Management</div>
        </div>

        <div className="auth-form-title">Sign in to your account</div>

        {location.state &&
          typeof location.state === 'object' &&
          'passwordReset' in location.state && (
            <div className="auth-success" role="status">
              Password updated. Sign in with your new password.
            </div>
          )}

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-form-group">
            <label htmlFor="sign-in-email">Email</label>
            <input
              id="sign-in-email"
              data-testid="sign-in-email"
              className="auth-input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="auth-form-group">
            <label htmlFor="sign-in-password">Password</label>
            <input
              id="sign-in-password"
              data-testid="sign-in-password"
              className="auth-input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <button
            type="submit"
            className="auth-submit"
            data-testid="sign-in-submit"
            disabled={submitting}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <Link className="auth-link" to="/forgot-password">
          Forgot password?
        </Link>
      </div>
    </div>
  )
}
