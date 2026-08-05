import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getOnboarding, type OnboardingState } from '../../api/client'
import type { UserRole } from '../../api/generated/types'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { OnboardingPage } from './OnboardingPage'
import { SetupReturnNotice } from './SetupReturnNotice'

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>()
  return { ...actual, getOnboarding: vi.fn() }
})

/**
 * SPA-only coverage per the validation pyramid: both rules under test are client wayfinding and
 * client cache policy. The server has no equivalent to mirror — `GET /api/v1/onboarding` is already
 * authoritative, and these tests exist because the client was not asking it often enough.
 */

const stages = [
  { id: 'ORGANIZATION', label: 'Organization' },
  { id: 'WORKING_CALENDARS', label: 'Working calendars' },
  { id: 'PEOPLE_AND_INVITATIONS', label: 'People and invitations' },
  { id: 'ENTITLEMENTS_AND_READINESS', label: 'Entitlements and readiness' },
  { id: 'FIRST_LEAVE_CYCLE', label: 'First leave cycle' },
] as const satisfies OnboardingState['stages']

function onboardingState(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    workflowVersion: '12.5-v1',
    stages: [...stages],
    evidence: { ORGANIZATION: { complete: false, summary: 'Complete organization details in Settings' } },
    currentPresentationStep: 'ORGANIZATION',
    nextSafeAction: {
      stage: 'ORGANIZATION',
      action: 'OPEN_ORGANIZATION_SETTINGS',
      href: '/settings?category=organization',
    },
    version: 1,
    activationStatus: 'NOT_ACTIVATED',
    workspaceCreated: true,
    presentationEnabled: true,
    ...overrides,
  }
}

function withProviders(client: QueryClient, ui: ReactElement) {
  return (
    <AuthTestProvider value={createMockAuthForRole('HR_ADMIN')}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/onboarding']}>{ui}</MemoryRouter>
      </QueryClientProvider>
    </AuthTestProvider>
  )
}

function renderNotice(path: string, role: UserRole = 'HR_ADMIN') {
  return render(
    <AuthTestProvider value={createMockAuthForRole(role)}>
      <MemoryRouter initialEntries={[path]}>
        <SetupReturnNotice />
      </MemoryRouter>
    </AuthTestProvider>,
  )
}

describe('Guided setup return loop', () => {
  beforeEach(() => {
    vi.mocked(getOnboarding).mockReset()
  })

  it('marks the next safe action so the destination can offer the way back', () => {
    render(
      <MemoryRouter>
        <OnboardingPage state={onboardingState()} />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('onboarding-next-action')).toHaveAttribute(
      'href',
      '/settings?category=organization&from=onboarding',
    )
  })

  it('leaves the dashboard destination unmarked — it carries its own cue', () => {
    render(
      <MemoryRouter>
        <OnboardingPage
          state={onboardingState({
            nextSafeAction: { stage: 'FIRST_LEAVE_CYCLE', action: 'VIEW_WORKSPACE', href: '/' },
          })}
        />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('onboarding-next-action')).toHaveAttribute('href', '/')
  })

  it('offers the way back on the destination the setup step sent the user to', () => {
    renderNotice('/settings?category=organization&from=onboarding')

    expect(screen.getByTestId('setup-return-notice')).toBeVisible()
    expect(screen.getByTestId('setup-return-action')).toHaveAttribute('href', '/onboarding')
  })

  it('stays out of the way when the user did not arrive from guided setup', () => {
    renderNotice('/settings?category=organization')

    expect(screen.queryByTestId('setup-return-notice')).not.toBeInTheDocument()
  })

  it('does not offer a return to the page the user is already on', () => {
    renderNotice('/onboarding?from=onboarding')

    expect(screen.queryByTestId('setup-return-notice')).not.toBeInTheDocument()
  })

  it('does not send a non-HR Admin to a route the guard will bounce', () => {
    renderNotice('/settings?category=organization&from=onboarding', 'EMPLOYEE')

    expect(screen.queryByTestId('setup-return-notice')).not.toBeInTheDocument()
  })
})

describe('Guided setup stage navigation', () => {
  it('links every stage to the surface that owns it, in any order', () => {
    render(
      <MemoryRouter>
        <OnboardingPage
          state={onboardingState({
            evidence: {
              ORGANIZATION: { complete: true, summary: 'Organization details are ready' },
              WORKING_CALENDARS: { complete: false, summary: 'Review groups, weekends, and holidays' },
            },
          })}
        />
      </MemoryRouter>,
    )

    // A completed stage stays reachable — the admin may want to revisit it.
    expect(screen.getByTestId('onboarding-stage-organization-link')).toHaveAttribute(
      'href',
      '/settings?category=organization&from=onboarding',
    )
    expect(screen.getByTestId('onboarding-stage-people-link')).toHaveAttribute(
      'href',
      '/settings?category=people&from=onboarding',
    )
    expect(screen.getByTestId('onboarding-stage-entitlements-link')).toHaveAttribute(
      'href',
      '/settings?category=leave-policies&from=onboarding',
    )
    expect(screen.getByTestId('onboarding-stage-first-leave-cycle-link')).toHaveAttribute(
      'href',
      '/my-leaves?from=onboarding',
    )
  })

  it('defers to the server href for the recommended stage so the two never disagree', () => {
    render(
      <MemoryRouter>
        <OnboardingPage
          state={onboardingState({
            nextSafeAction: {
              stage: 'FIRST_LEAVE_CYCLE',
              action: 'APPROVE_FIRST_REQUEST',
              href: '/approvals',
            },
          })}
        />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('onboarding-stage-first-leave-cycle-link')).toHaveAttribute(
      'href',
      '/approvals?from=onboarding',
    )
    // Every other row still uses the static table.
    expect(screen.getByTestId('onboarding-stage-organization-link')).toHaveAttribute(
      'href',
      '/settings?category=organization&from=onboarding',
    )
  })
})

describe('First leave cycle framing', () => {
  it('states plainly that nothing is restricted, in the user\'s vocabulary', () => {
    render(
      <MemoryRouter>
        <OnboardingPage state={onboardingState()} />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('activation-reassurance')).toHaveTextContent(
      /your account is live and nothing is restricted/i,
    )
    expect(screen.getByTestId('activation-status')).toHaveTextContent(/first leave cycle/i)
    expect(screen.queryByText(/commercially activated/i)).not.toBeInTheDocument()
  })

  it('labels steps the admin cannot complete alone as waiting, not as their to-do', () => {
    render(
      <MemoryRouter>
        <OnboardingPage state={onboardingState({ onboardingComplete: false })} />
      </MemoryRouter>,
    )

    // Externally dependent: nothing the admin can do moves this one.
    expect(screen.getByTestId('activation-state-commercialActivation')).toHaveTextContent(
      /waiting for your team/i,
    )
    // User-owned and outstanding: stays a to-do.
    expect(screen.getByTestId('activation-state-onboardingComplete')).toHaveTextContent(/to do/i)
    // User-owned and already done.
    expect(screen.getByTestId('activation-state-emailVerified')).toHaveTextContent(/done/i)
  })

  it('keeps all six milestones distinct for the funnel', () => {
    render(
      <MemoryRouter>
        <OnboardingPage state={onboardingState({ plan: 'STARTER' })} />
      </MemoryRouter>,
    )

    for (const key of [
      'registrationAccepted',
      'emailVerified',
      'paymentConfirmed',
      'workspaceCreated',
      'onboardingComplete',
      'commercialActivation',
    ]) {
      expect(screen.getByTestId(`activation-state-${key}`)).toBeVisible()
    }
  })
})

describe('Guided setup progress freshness', () => {
  beforeEach(() => {
    vi.mocked(getOnboarding).mockReset()
  })

  it('re-reads evidence on return even inside the 30s cache window', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.mocked(getOnboarding).mockResolvedValue(onboardingState())

    const first = render(withProviders(client, <OnboardingPage />))
    await screen.findByTestId('onboarding-page')
    expect(screen.getByTestId('onboarding-stage-organization')).toHaveTextContent(/next safe action/i)
    expect(getOnboarding).toHaveBeenCalledTimes(1)

    // The user completes the step in Settings and comes straight back — well inside staleTime.
    first.unmount()
    vi.mocked(getOnboarding).mockResolvedValue(
      onboardingState({
        evidence: { ORGANIZATION: { complete: true, summary: 'Organization details are ready' } },
        nextSafeAction: {
          stage: 'WORKING_CALENDARS',
          action: 'OPEN_WORKING_CALENDARS',
          href: '/settings?category=working-calendars',
        },
      }),
    )

    render(withProviders(client, <OnboardingPage />))

    // Serving the cached copy here is the defect: the step they just finished read as outstanding.
    await waitFor(() => expect(getOnboarding).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.getByTestId('onboarding-stage-organization')).toHaveTextContent(/complete/i),
    )
  })

  it('announces the re-read in the status region rather than swapping silently', () => {
    render(
      <MemoryRouter>
        <OnboardingPage state={onboardingState()} isRefreshing />
      </MemoryRouter>,
    )

    const status = screen.getByTestId('onboarding-resume-status')
    expect(status).toHaveTextContent(/checking your latest saved progress/i)
    expect(status).toHaveAttribute('aria-busy', 'true')
  })
})
