import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../../i18n/config'
import type { ToastState } from './toastContext'
import { CloseIcon } from './icons'
import './toast.css'

const TOAST_DURATION_MS = 5000

type ToastProps = {
  toast: ToastState | null
  onDismiss: () => void
}

/**
 * Shared toast presentation: bottom-right, auto-dismisses after 5s, pauses the
 * timer while hovered or focused, and always offers an explicit dismiss button.
 * Success uses role="status"; warnings use role="alert". Pair with useToast().
 */
export function Toast({ toast, onDismiss }: ToastProps) {
  const { t } = useTranslation('common')
  const [paused, setPaused] = useState(false)
  const remainingRef = useRef(TOAST_DURATION_MS)
  const startedAtRef = useRef(0)

  useEffect(() => {
    remainingRef.current = TOAST_DURATION_MS
  }, [toast])

  useEffect(() => {
    if (!toast || paused) {
      return undefined
    }
    startedAtRef.current = Date.now()
    const timer = window.setTimeout(onDismiss, remainingRef.current)
    return () => {
      window.clearTimeout(timer)
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startedAtRef.current),
      )
    }
  }, [toast, paused, onDismiss])

  if (!toast) {
    return null
  }

  const isWarning = toast.tone === 'warning'

  return (
    <div
      className={`app-toast${isWarning ? ' app-toast-warning' : ''}`}
      role={isWarning ? 'alert' : 'status'}
      aria-live={isWarning ? 'assertive' : 'polite'}
      data-testid="app-toast"
      data-tone={toast.tone}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="app-toast-message">{toast.message}</span>
      <button
        type="button"
        className="app-toast-dismiss"
        aria-label={t('toast.dismiss')}
        onClick={onDismiss}
      >
        <CloseIcon size={14} />
      </button>
    </div>
  )
}
