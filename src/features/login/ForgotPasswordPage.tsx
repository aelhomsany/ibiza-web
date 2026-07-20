import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ApiError, postForgotPassword } from '../../api/client'
import { UmbrellaIcon } from '../../components/ui/icons'
import './auth-form.css'

export function ForgotPasswordPage() {
  const { t } = useTranslation(['auth', 'common'])
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await postForgotPassword({ email: email.trim() })
      setSubmitted(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(t('auth:errors.tooMany'))
      } else {
        setError(t('auth:errors.forgot'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page" data-testid="forgot-password-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon" aria-hidden="true">
            <UmbrellaIcon size={34} />
          </div>
          <div className="auth-logo-title">{t('common:brand.name')}</div>
          <div className="auth-logo-sub">{t('common:brand.tagline')}</div>
        </div>

        <div className="auth-form-title">{t('auth:forgot.title')}</div>

        {submitted ? (
          <div className="auth-success" role="status">
            {t('auth:forgot.success')}
          </div>
        ) : (
          <>
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="auth-form-group">
                <label htmlFor="forgot-email">{t('auth:fields.email')}</label>
                <input
                  id="forgot-email"
                  data-testid="forgot-email"
                  className="auth-input"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                {submitting ? t('auth:actions.sending') : t('auth:actions.sendReset')}
              </button>
            </form>
          </>
        )}

        <Link className="auth-link" to="/login">
          {t('auth:actions.backToSignIn')}
        </Link>
      </div>
    </div>
  )
}
