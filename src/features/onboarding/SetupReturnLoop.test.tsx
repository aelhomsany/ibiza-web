import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getOnboarding, type OnboardingState } from '../../api/client'
import type { UserRole } from '../../api/generated/types'
import { ToastProvider } from '../../components/ui/ToastProvider'
import i18n from '../../i18n/config'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { OnboardingPage } from './OnboardingPage'
import {
  clearOnboardingRedirectSkip,
  hasSkippedOnboardingRedirect,
  skipOnboardingRedirect,
} from './redirectPreference'
import { SetupReturnNotice } from './SetupReturnNotice'
import { STAGE_HREFS, safeHref, withSetupReturn } from './stageRoutes'

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

  it('can be dismissed, since the marker rides in a URL the user may have bookmarked', async () => {
    window.sessionStorage.clear()
    renderNotice('/settings?category=organization&from=onboarding')

    await userEvent.click(screen.getByTestId('setup-return-dismiss'))

    expect(screen.queryByTestId('setup-return-notice')).not.toBeInTheDocument()
  })

  it('stays dismissed for the rest of the tab session', async () => {
    window.sessionStorage.clear()
    const first = renderNotice('/settings?category=organization&from=onboarding')
    await userEvent.click(screen.getByTestId('setup-return-dismiss'))
    first.unmount()

    // A reload within the same tab must not resurrect it.
    renderNotice('/settings?category=people&from=onboarding')

    expect(screen.queryByTestId('setup-return-notice')).not.toBeInTheDocument()
  })

  it('mirrors the back affordance for Arabic RTL', async () => {
    window.sessionStorage.clear()
    await act(async () => {
      await i18n.changeLanguage('ar')
    })

    renderNotice('/settings?category=organization&from=onboarding')

    const notice = screen.getByTestId('setup-return-notice')
    expect(notice).toBeVisible()
    expect(notice).toHaveTextContent('أنت في الإعداد الموجّه')
    expect(screen.getByTestId('setup-return-action')).toHaveTextContent('العودة إلى الإعداد')
    expect(screen.getByTestId('setup-return-dismiss')).toHaveAttribute(
      'aria-label',
      'إغلاق شريط الإعداد الموجّه',
    )

    await act(async () => {
      await i18n.changeLanguage('en')
    })
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

  it('keeps a row pointing at the same place regardless of which stage is recommended', () => {
    // The server's next-safe-action walks sub-steps within FIRST_LEAVE_CYCLE (/approvals, then
    // /my-leaves, then /calendar). Honouring it per row moved the row under the user between
    // visits, so the row uses the stage table and the Continue button keeps the server's step.
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
      '/my-leaves?from=onboarding',
    )
    expect(screen.getByTestId('onboarding-stage-organization-link')).toHaveAttribute(
      'href',
      '/settings?category=organization&from=onboarding',
    )
    // The server's more precise step is still offered — just not as the row's destination.
    expect(screen.getByTestId('onboarding-next-action')).toHaveAttribute(
      'href',
      '/approvals?from=onboarding',
    )
  })

  it('routes every stage in the table to a path the customer app actually serves', () => {
    // STAGE_HREFS type-checks its keys and never its values, so a route rename would otherwise
    // leave rows deep-linking to dead URLs with no type error and no failing test.
    const served = new Set(['/settings', '/my-leaves', '/approvals', '/calendar', '/'])
    for (const href of Object.values(STAGE_HREFS)) {
      expect(served).toContain(href.split('?')[0])
    }
  })

  it('refuses an off-origin href disguised as an app path', () => {
    // Browsers normalise the backslash, so '/\evil.com' resolves off-origin on middle-click even
    // though it passes a naive startsWith('/') check.
    expect(safeHref('/\\evil.com')).toBe('/settings')
    expect(safeHref('//evil.com')).toBe('/settings')
    expect(safeHref('https://evil.com')).toBe('/settings')
    expect(safeHref('/settings?category=people')).toBe('/settings?category=people')
    expect(safeHref('/')).toBe('/')
  })

  it('keeps the return marker outside the fragment', () => {
    // '/settings#section'.split('?') yields no query, so a naive append puts ?from= inside the
    // fragment and useSearchParams never sees it.
    expect(withSetupReturn('/settings#people')).toBe('/settings?from=onboarding#people')
    expect(withSetupReturn('/settings?category=people')).toBe(
      '/settings?category=people&from=onboarding',
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
    // "first leave cycle" alone matches BOTH the run and not-run strings, so it cannot tell the
    // two apart — assert the clause that actually differs.
    expect(screen.getByTestId('activation-status')).toHaveTextContent(/hasn't run yet/i)
    expect(screen.getByTestId('activation-status')).not.toHaveTextContent(/is complete/i)
  })

  it('states the run cycle distinctly from the not-yet-run one', () => {
    render(
      <MemoryRouter>
        <OnboardingPage
          state={onboardingState({ activationStatus: 'COMMERCIALLY_ACTIVATED' })}
        />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('activation-status')).toHaveTextContent(/is complete/i)
    expect(screen.getByTestId('activation-status')).not.toHaveTextContent(/hasn't run yet/i)
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
    // Provisioning precedes setup and is blocked on nobody — it is not a "waiting on others" step.
    expect(screen.getByTestId('activation-state-workspaceCreated')).not.toHaveTextContent(
      /waiting for/i,
    )
  })

  it('does not tell an Organization it confirmed payment while billing is still recovering', () => {
    // The server sends billingInOnboarding for PENDING_PAYMENT / PAST_DUE_GRACE / RESTRICTED.
    // Reading plan alone told an unpaid Organization, in the first person, that it had paid.
    render(
      <MemoryRouter>
        <OnboardingPage
          state={onboardingState({ plan: 'GROWTH', billingInOnboarding: true })}
        />
      </MemoryRouter>,
    )

    const payment = screen.getByTestId('activation-state-paymentConfirmed')
    expect(payment).not.toHaveTextContent(/you confirmed payment/i)
    expect(payment).toHaveTextContent(/confirm your payment/i)
    expect(payment).toHaveTextContent(/to do/i)
  })

  it('confirms payment once billing has settled', () => {
    render(
      <MemoryRouter>
        <OnboardingPage
          state={onboardingState({ plan: 'GROWTH', billingInOnboarding: false })}
        />
      </MemoryRouter>,
    )

    const payment = screen.getByTestId('activation-state-paymentConfirmed')
    expect(payment).toHaveTextContent(/you confirmed payment/i)
    expect(payment).toHaveTextContent(/done/i)
  })

  it('keeps all six milestones distinct for the funnel, each with a readable name', () => {
    render(
      <MemoryRouter>
        <OnboardingPage state={onboardingState({ plan: 'GROWTH' })} />
      </MemoryRouter>,
    )

    // Names asserted, not just presence: a visible row with an empty label still passes
    // toBeVisible(), which is how a blank milestone list reached a screenshot once already.
    const expected: Record<string, RegExp> = {
      registrationAccepted: /you created your account/i,
      emailVerified: /you verified your email/i,
      paymentConfirmed: /payment/i,
      workspaceCreated: /your workspace was created/i,
      onboardingComplete: /you finished workspace setup/i,
      commercialActivation: /your team ran a real leave cycle/i,
    }
    for (const [key, name] of Object.entries(expected)) {
      const row = screen.getByTestId(`activation-state-${key}`)
      expect(row).toBeVisible()
      expect(row).toHaveTextContent(name)
    }
  })
})

describe('Guided setup progress legibility', () => {
  it('counts progress over the stages the admin controls, not the ones they cannot finish', () => {
    render(
      <MemoryRouter>
        <OnboardingPage
          state={onboardingState({
            evidence: {
              ORGANIZATION: { complete: true },
              ENTITLEMENTS_AND_READINESS: { complete: true },
            },
          })}
        />
      </MemoryRouter>,
    )

    // 4 owned stages, not 5 — "First leave cycle" turns on other people.
    expect(screen.getByTestId('onboarding-progress-count')).toHaveTextContent(
      /setup progress: 2 of 4/i,
    )
  })

  it('keeps the progress landmark addressable when there are no owned stages', () => {
    // An empty or all-waiting list used to render a labelled landmark containing nothing, taking
    // the onboarding-progress id with it — the E2E that waits on it hung rather than failing.
    render(
      <MemoryRouter>
        <OnboardingPage state={onboardingState({ stages: [] })} />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('onboarding-progress')).toBeVisible()
    expect(screen.queryByTestId('onboarding-progress-count')).not.toBeInTheDocument()
  })

  it('separates the admin\'s setup from what the team has to do', () => {
    render(
      <MemoryRouter>
        <OnboardingPage state={onboardingState()} />
      </MemoryRouter>,
    )

    const owned = screen.getByTestId('onboarding-progress')
    const waiting = screen.getByTestId('onboarding-progress-waiting')

    expect(owned).toContainElement(screen.getByTestId('onboarding-stage-organization'))
    expect(owned).not.toContainElement(screen.getByTestId('onboarding-stage-first-leave-cycle'))
    expect(waiting).toContainElement(screen.getByTestId('onboarding-stage-first-leave-cycle'))
    expect(screen.getByText(/nothing here is yours to complete/i)).toBeVisible()
  })

  it('keeps each stage numbered by its place in the whole workflow', () => {
    render(
      <MemoryRouter>
        <OnboardingPage state={onboardingState()} />
      </MemoryRouter>,
    )

    // Splitting the list must not renumber the waiting stage as step 1.
    expect(screen.getByTestId('onboarding-stage-first-leave-cycle')).toHaveTextContent('5')
  })
})

describe('Guided setup can be postponed', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('records a persisted opt-out so sign-in stops overriding where the admin was going', async () => {
    const onSkip = vi.fn()
    render(
      <MemoryRouter>
        <OnboardingPage state={onboardingState()} onSkip={onSkip} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByTestId('onboarding-skip-action'))
    expect(onSkip).toHaveBeenCalled()
  })

  it('remembers the opt-out per user, so a shared browser cannot silence another account', () => {
    expect(hasSkippedOnboardingRedirect(5)).toBe(false)
    skipOnboardingRedirect(5)
    expect(hasSkippedOnboardingRedirect(5)).toBe(true)
    expect(hasSkippedOnboardingRedirect(9)).toBe(false)
  })

  it('treats an unknown user as not opted out rather than throwing', () => {
    expect(hasSkippedOnboardingRedirect(undefined)).toBe(false)
    expect(() => skipOnboardingRedirect(undefined)).not.toThrow()
    expect(() => clearOnboardingRedirectSkip(undefined)).not.toThrow()
  })

  // withProviders signs in as mockUsers.hrAdmin, whose id is 5.
  const HR_ADMIN_ID = 5

  it('drops the opt-out once setup is finished, so it cannot govern a later cycle', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.mocked(getOnboarding).mockResolvedValue(onboardingState({ onboardingComplete: true }))
    skipOnboardingRedirect(HR_ADMIN_ID)
    expect(hasSkippedOnboardingRedirect(HR_ADMIN_ID)).toBe(true)

    render(withProviders(client, <OnboardingPage />))
    await screen.findByTestId('onboarding-page')

    await waitFor(() => {
      expect(hasSkippedOnboardingRedirect(HR_ADMIN_ID)).toBe(false)
    })
  })

  it('keeps the opt-out while setup is still outstanding', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.mocked(getOnboarding).mockResolvedValue(onboardingState({ onboardingComplete: false }))
    skipOnboardingRedirect(HR_ADMIN_ID)

    render(withProviders(client, <OnboardingPage />))
    await screen.findByTestId('onboarding-page')

    expect(hasSkippedOnboardingRedirect(HR_ADMIN_ID)).toBe(true)
  })

  it('offers no skip control on the read-only presentation path', () => {
    render(
      <MemoryRouter>
        <OnboardingPage state={onboardingState()} />
      </MemoryRouter>,
    )

    expect(screen.queryByTestId('onboarding-skip-action')).not.toBeInTheDocument()
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

  it('explains the redirect instead of dropping a legacy org on the dashboard in silence', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.mocked(getOnboarding).mockRejectedValue(
      new ApiError(404, {
        type: 'https://ibiza.app/errors/not-found',
        title: 'Not Found',
        status: 404,
        detail: 'This organization predates guided onboarding and uses the standard Settings flow.',
        instance: '/api/v1/onboarding',
      }),
    )

    render(
      <AuthTestProvider value={createMockAuthForRole('HR_ADMIN')}>
        <QueryClientProvider client={client}>
          <ToastProvider>
            <MemoryRouter initialEntries={['/onboarding']}>
              <Routes>
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/" element={<p>Dashboard</p>} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>
      </AuthTestProvider>,
    )

    expect(await screen.findByText('Dashboard')).toBeVisible()
    expect(
      await screen.findByText(/guided setup isn't available for this workspace/i),
    ).toBeVisible()
  })

  it('announces the re-read in the status region rather than swapping silently', () => {
    render(
      <MemoryRouter>
        <OnboardingPage state={onboardingState()} isRefreshing />
      </MemoryRouter>,
    )

    const status = screen.getByTestId('onboarding-resume-status')
    expect(status).toHaveTextContent(/checking your latest saved progress/i)
    expect(status).toHaveAttribute('role', 'status')
    // Deliberately no aria-busy: on the live region itself it tells assistive tech to withhold
    // updates, which suppressed this very message and let only the idle text through.
    expect(status).not.toHaveAttribute('aria-busy')
  })
})
