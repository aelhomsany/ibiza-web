import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthTestProvider, createMockAuthValue } from '../test/authTestUtils'
import { ProtectedRoute } from './ProtectedRoute'

function ProtectedContent() {
  return <div data-testid="protected-content">Protected</div>
}

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to login', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthTestProvider
          value={createMockAuthValue({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          })}
        >
          <Routes>
            <Route path="/login" element={<div data-testid="login-page">Login</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<ProtectedContent />} />
            </Route>
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('renders child routes when authenticated', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthTestProvider>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<ProtectedContent />} />
            </Route>
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  it('shows loading state while auth bootstraps', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthTestProvider
          value={createMockAuthValue({
            isLoading: true,
          })}
        >
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<ProtectedContent />} />
            </Route>
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('auth-loading')).toBeInTheDocument()
  })
})
