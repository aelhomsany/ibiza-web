import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { OnboardingPage } from './OnboardingPage'

/**
 * Story 12.5 ATDD RED — ONBOARDING-VAL-002/003/005/006/014 + analytics-refusal UX.
 *
 * Runnable SPA-only coverage for the guided onboarding presentation: progress and
 * next-safe-action derived from server evidence, activation-state copy, and analytics-refusal (tests then fail red until green).
 */
describe('Guided onboarding UX — Story 12.5', () => {
  it('[ONBOARDING-VAL-002/014] renders five stages and distinguishes workspace vs Commercial Activation', () => {
    render(
      <MemoryRouter><OnboardingPage
        state={{
          workflowVersion: '12.5-v1',
          stages: [
            { id: 'ORGANIZATION', label: 'Organization' },
            { id: 'WORKING_CALENDARS', label: 'Working calendars' },
            { id: 'PEOPLE_AND_INVITATIONS', label: 'People and invitations' },
            { id: 'ENTITLEMENTS_AND_READINESS', label: 'Entitlements and readiness' },
            { id: 'FIRST_LEAVE_CYCLE', label: 'First leave cycle' },
          ],
          evidence: {},
          currentPresentationStep: 'ORGANIZATION',
          nextSafeAction: { stage: 'ORGANIZATION', href: '/settings?category=organization' },
          version: 1,
          activationStatus: 'NOT_ACTIVATED',
          workspaceCreated: true,
          billingInOnboarding: false,
        }}
      /></MemoryRouter>,
    )

    expect(screen.getByTestId('onboarding-progress')).toBeVisible()
    expect(screen.getByTestId('onboarding-stage-organization')).toBeVisible()
    expect(screen.getByTestId('onboarding-stage-working-calendars')).toBeVisible()
    expect(screen.getByTestId('onboarding-stage-people')).toBeVisible()
    expect(screen.getByTestId('onboarding-stage-entitlements')).toBeVisible()
    expect(screen.getByTestId('onboarding-stage-first-leave-cycle')).toBeVisible()
    expect(screen.getByTestId('activation-status')).toHaveTextContent(/not commercially activated|workspace created/i)
    expect(screen.queryByTestId('commercial-activation-reached')).not.toBeInTheDocument()
  })

  it('[ONBOARDING-VAL-003] Free path never shows billing chrome', () => {
    render(
      <MemoryRouter><OnboardingPage
        state={{
          workflowVersion: '12.5-v1',
          stages: [],
          evidence: {},
          currentPresentationStep: 'ORGANIZATION',
          nextSafeAction: { stage: 'ORGANIZATION', href: '/settings' },
          version: 1,
          activationStatus: 'NOT_ACTIVATED',
          workspaceCreated: true,
          billingInOnboarding: false,
          plan: 'FREE',
        }}
      /></MemoryRouter>,
    )

    expect(screen.queryByText(/checkout|stripe|payment method|billing portal/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('onboarding-billing')).not.toBeInTheDocument()
  })

  it('[ONBOARDING-VAL-005/006] resume uses next safe action; conflict preserves recoverable input', async () => {
    const onRetry = vi.fn()
    render(
      <MemoryRouter><OnboardingPage
        state={{
          workflowVersion: '12.5-v1',
          stages: [],
          evidence: { ORGANIZATION: { complete: false } },
          currentPresentationStep: 'PEOPLE_AND_INVITATIONS',
          nextSafeAction: { stage: 'ORGANIZATION', href: '/settings?category=organization' },
          version: 2,
          activationStatus: 'NOT_ACTIVATED',
          workspaceCreated: true,
          conflict: {
            message: 'Onboarding changed since you started editing',
            recoverableInput: { organizationName: 'Jordan Co' },
          },
        }}
        onRetryConflict={onRetry}
      /></MemoryRouter>,
    )

    expect(screen.getByTestId('onboarding-next-action')).toHaveAttribute(
      'href',
      '/settings?category=organization',
    )
    expect(screen.getByTestId('onboarding-stale-conflict')).toBeVisible()
    expect(screen.getByDisplayValue('Jordan Co')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: /reload|retry/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('[ONBOARDING-VAL-020] analytics refusal does not block Continue', () => {
    render(
      <MemoryRouter><OnboardingPage
        state={{
          workflowVersion: '12.5-v1',
          stages: [],
          evidence: {},
          currentPresentationStep: 'ORGANIZATION',
          nextSafeAction: { stage: 'ORGANIZATION', href: '/settings' },
          version: 1,
          activationStatus: 'NOT_ACTIVATED',
          workspaceCreated: true,
          analyticsConsent: 'NECESSARY_ONLY',
        }}
      /></MemoryRouter>,
    )

    expect(screen.getByTestId('onboarding-next-action')).toBeEnabled()
    expect(screen.queryByText(/enable analytics to continue/i)).not.toBeInTheDocument()
  })
})
