import { QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from '../../components/ui/ErrorBoundary'
import { ToastProvider } from '../../components/ui/ToastProvider'
import { createQueryClient } from '../../lib/queryClient'
import { AdminRouter } from './AdminRouter'

const queryClient = createQueryClient()

export function AdminApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ErrorBoundary variant="app">
          <AdminRouter />
        </ErrorBoundary>
      </ToastProvider>
    </QueryClientProvider>
  )
}
