import { QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from '../../components/ui/ErrorBoundary'
import { ToastProvider } from '../../components/ui/ToastProvider'
import { createQueryClient } from '../../lib/queryClient'
import { CustomerRouter } from './CustomerRouter'

const queryClient = createQueryClient()

export function CustomerApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ErrorBoundary variant="app">
          <CustomerRouter />
        </ErrorBoundary>
      </ToastProvider>
    </QueryClientProvider>
  )
}
