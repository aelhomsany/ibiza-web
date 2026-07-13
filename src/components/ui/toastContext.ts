import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'warning'

export type ToastState = {
  message: string
  tone: ToastTone
}

export type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void
  dismissToast: () => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
