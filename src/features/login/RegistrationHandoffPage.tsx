import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { baseUrl } from '../../api/client'
import { setAccessToken } from '../../auth/tokenStorage'

type HandoffResponse = { accessToken: string; safeReturnPath?: string }

/**
 * The destination is re-checked here even though the server allowlisted it at registration start
 * and stores it itself — a redirect target that arrives over the network is never trusted twice.
 */
function safeDestination(path: string | undefined): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return '/'
  return path === '/' || path === '/onboarding' || path === '/settings' || path.startsWith('/settings?') || path.startsWith('/settings#')
    ? path
    : '/'
}

export function RegistrationHandoffPage() {
  const { t } = useTranslation('common')
  const [failed, setFailed] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const code = new URLSearchParams(window.location.search).get('code') ?? ''
    window.history.replaceState({}, '', '/login/handoff')
    if (!code) {
      setFailed(true)
      return
    }
    void fetch(`${baseUrl}/api/v1/auth/registration-handoff`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).then(async (response) => {
      if (!response.ok) throw new Error('handoff rejected')
      const result = await response.json() as HandoffResponse
      setAccessToken(result.accessToken)
      window.location.replace(safeDestination(result.safeReturnPath))
    }).catch(() => setFailed(true))
  }, [])

  return (
    <main className="auth-page" data-testid="handoff-status">
      <section className="auth-form-card" aria-live="polite">
        <h1>{failed ? t('handoff.failedTitle') : t('handoff.title')}</h1>
        <p>{failed ? t('handoff.failedBody') : t('handoff.body')}</p>
        {failed ? <a className="btn btn-primary" href="/register/recovery">{t('handoff.recover')}</a> : null}
      </section>
    </main>
  )
}
