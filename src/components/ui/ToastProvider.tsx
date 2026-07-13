import { useCallback, useState, type ReactNode } from 'react'
import { Toast } from './Toast'
import { ToastContext, type ToastState, type ToastTone } from './toastContext'

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    setToast({ message, tone })
  }, [])

  const dismissToast = useCallback(() => {
    setToast(null)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <Toast toast={toast} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}
