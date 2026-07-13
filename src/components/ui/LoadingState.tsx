import type { ReactNode } from 'react'

export type LoadingStateProps = {
  label: string
  testId?: string
  variant?: 'inline' | 'block' | 'skeleton'
  className?: string
  children?: ReactNode
}

export function LoadingState({
  label,
  testId,
  variant = 'inline',
  className,
  children,
}: LoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <div role="status" aria-busy="true" aria-label={label} data-testid={testId}>
        <span className="sr-only">{label}</span>
        {children}
      </div>
    )
  }

  const variantClass =
    variant === 'block'
      ? 'dashboard-section-loading body-text'
      : className ?? 'body-text'

  return (
    <div
      className={variantClass}
      role="status"
      aria-busy="true"
      aria-label={label}
      data-testid={testId}
    >
      {label}
    </div>
  )
}
