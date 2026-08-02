import { useCallback, useEffect, useRef, useState } from 'react'

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: { sitekey: string; action?: string; 'error-callback'?: () => void },
  ) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
  getResponse: (widgetId?: string) => string | undefined
}

function turnstile(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile
}

/**
 * Renders one Turnstile widget explicitly and keeps hold of its id.
 *
 * <p>Two things this fixes over the implicit `.cf-turnstile` scan. First, the scan runs once when
 * the API script loads, so any widget mounted afterwards — every phase of a multi-step form —
 * never initializes and silently yields an empty token. Second, `turnstile.reset()` with no
 * argument targets the last widget the library rendered, which after a phase change is not the
 * one on screen; resetting by id makes "retry after a failed submit" actually reset the visible
 * challenge.
 */
export function useTurnstileWidget(enabled: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  // Surfaced so the form can explain why submission is blocked rather than failing with a
  // generic error after the server rejects an empty token.
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    if (!enabled) return
    setUnavailable(false)
    const siteKey = import.meta.env.VITE_PUBLIC_TURNSTILE_SITE_KEY
    if (!siteKey) {
      // A production build without the site key can never produce a token. DEV short-circuits in
      // `token()`, so this only reports a genuine misconfiguration.
      if (!import.meta.env.DEV) setUnavailable(true)
      return
    }

    let cancelled = false
    let pollTimer: number | undefined
    // Bounded so a blocked or failed script load ends in a definite state instead of an
    // unbounded 50ms timer that keeps the tab busy forever while every submit fails.
    let attemptsLeft = 200

    const mount = () => {
      if (cancelled || widgetIdRef.current || !containerRef.current) return
      const api = turnstile()
      if (!api) {
        // The API script is async/defer, so it may not have executed yet.
        if (attemptsLeft-- <= 0) {
          setUnavailable(true)
          return
        }
        pollTimer = window.setTimeout(mount, 50)
        return
      }
      // The action comes from the container's data-action rather than a literal here, so the
      // server-rendered markup stays the single declaration of which action this widget is bound
      // to — that is what verify-public-output.mjs asserts, and what the API verifies server-side.
      try {
        // render throws on an invalid sitekey and on re-rendering into an occupied container.
        // Uncaught, that escapes the effect and takes down the whole registration tree.
        widgetIdRef.current = api.render(containerRef.current, {
          sitekey: siteKey,
          action: containerRef.current.dataset.action ?? 'registration',
          'error-callback': () => setUnavailable(true),
        })
      } catch {
        setUnavailable(true)
      }
    }
    mount()

    return () => {
      cancelled = true
      if (pollTimer) window.clearTimeout(pollTimer)
      if (widgetIdRef.current) {
        try {
          turnstile()?.remove(widgetIdRef.current)
        } catch {
          // Widget already torn down with its container.
        }
        widgetIdRef.current = null
      }
    }
  }, [enabled])

  const token = useCallback((): string => {
    if (import.meta.env.DEV) return 'test-token'
    if (!widgetIdRef.current) return ''
    return turnstile()?.getResponse(widgetIdRef.current) ?? ''
  }, [])

  const reset = useCallback(() => {
    if (!widgetIdRef.current) return
    try {
      turnstile()?.reset(widgetIdRef.current)
    } catch {
      // The original request error remains the useful error.
    }
  }, [])

  return { containerRef, token, reset, unavailable }
}
