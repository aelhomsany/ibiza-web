import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../api/client'
import { OrganizationsPage } from './OrganizationsPage'
import { ToastProvider } from '../../components/ui/ToastProvider'

function renderOrganizationsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <OrganizationsPage />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('OrganizationsPage design-system ATDD — Story 10.6', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getPlatformOrganizations').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('[P1] create organization CTA has accessible name without + text glyph', async () => {
    renderOrganizationsPage()

    await screen.findByRole('heading', { name: 'No organizations yet' })

    const createButtons = screen.getAllByRole('button', { name: /^create organization$/i })
    expect(createButtons).toHaveLength(2)
    createButtons.forEach((button) => {
      expect(button.textContent?.trim()).not.toMatch(/^\+/)
    })
  })

  it('[P1] create organization CTA renders PlusIcon instead of + text glyph', async () => {
    const { container } = renderOrganizationsPage()

    await screen.findByRole('heading', { name: 'No organizations yet' })

    const createButtons = screen.getAllByRole('button', { name: /^create organization$/i })
    createButtons.forEach((button) => {
      expect(button.querySelector('svg')).toBeInTheDocument()
      expect(button.textContent).not.toContain('+')
    })
    expect(container.textContent).not.toMatch(/\+ Create Organization/)
  })
})
