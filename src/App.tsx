import { QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { ToastProvider } from './components/ui/ToastProvider'
import { createQueryClient } from './lib/queryClient'
import { AppRouter } from './routes/AppRouter'

const queryClient = createQueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ErrorBoundary variant="app">
          <AppRouter />
        </ErrorBoundary>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
