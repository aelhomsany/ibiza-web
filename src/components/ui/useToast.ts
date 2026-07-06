import { useCallback, useState } from 'react'

export type ToastTone = 'success' | 'warning'

export type ToastState = {
  message: string
  tone: ToastTone
}

/**
 * Shared toast state for a page. Use together with <Toast>:
 *
 *   const { toast, showToast, dismissToast } = useToast()
 *   showToast('Saved!')                    // success tone
 *   showToast('Something failed', 'warning')
 *   <Toast toast={toast} onDismiss={dismissToast} testId="settings-toast" />
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    setToast({ message, tone })
  }, [])

  const dismissToast = useCallback(() => {
    setToast(null)
  }, [])

  return { toast, showToast, dismissToast }
}
