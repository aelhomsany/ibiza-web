import { Component, createRef, Fragment, type ErrorInfo, type ReactNode } from 'react'
import i18n from '../../i18n/config'

type ErrorBoundaryVariant = 'route' | 'app'

type ErrorBoundaryProps = {
  children: ReactNode
  variant?: ErrorBoundaryVariant
}

type ErrorBoundaryState = {
  hasError: boolean
  resetKey: number
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    resetKey: 0,
  }

  private headingRef = createRef<HTMLHeadingElement>()

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Ibiza render error caught by boundary', error, errorInfo)
    }
    this.headingRef.current?.focus()
  }

  handleRetry = () => {
    this.setState((state) => ({
      hasError: false,
      resetKey: state.resetKey + 1,
    }))
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    const variant = this.props.variant ?? 'route'

    if (!this.state.hasError) {
      return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>
    }

    if (variant === 'app') {
      return (
        <div className="app-recovery" data-testid="app-error-fallback">
          <section
            className="recovery-card"
            role="alert"
            aria-live="assertive"
            aria-labelledby="app-recovery-title"
          >
            <h1
              id="app-recovery-title"
              className="page-title"
              tabIndex={-1}
              ref={this.headingRef}
            >
              {i18n.t('common:recovery.heading')}
            </h1>
            <p className="page-sub">{i18n.t('common:recovery.app')}</p>
            <RecoveryActions onRetry={this.handleRetry} onReload={this.handleReload} />
          </section>
        </div>
      )
    }

    return (
      <div className="page page-wide" data-testid="route-error-fallback">
        <section
          className="recovery-card"
          role="alert"
          aria-live="assertive"
          aria-labelledby="route-recovery-title"
        >
          <h1
            id="route-recovery-title"
            className="page-title"
            tabIndex={-1}
            ref={this.headingRef}
          >
            {i18n.t('common:recovery.heading')}
          </h1>
          <p className="page-sub">{i18n.t('common:recovery.route')}</p>
          <RecoveryActions onRetry={this.handleRetry} onReload={this.handleReload} />
        </section>
      </div>
    )
  }
}

function RecoveryActions({ onRetry, onReload }: { onRetry: () => void; onReload: () => void }) {
  return (
    <div className="recovery-actions">
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        {i18n.t('common:actions.retry')}
      </button>
      <button type="button" className="btn btn-outline" onClick={onReload}>
        {i18n.t('common:actions.reload')}
      </button>
    </div>
  )
}
