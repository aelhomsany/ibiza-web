import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PricingRecommendation } from './PricingRecommendation'

/**
 * Story 12.2 SPA-only Pricing UX (SALES-VAL-001–007, keyboard).
 * Band commercial truth stays API-authoritative; these tests cover recommendation
 * display from catalog props, preserved plan/count/locale, and keyboard reach.
 */
describe('PricingRecommendation ATDD — Story 12.2', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost')
      const count = Number(url.searchParams.get('intendedCount'))
      const recommendedPlan = count <= 5
        ? 'FREE'
        : count <= 50
          ? 'STARTER'
          : count <= 200
            ? 'GROWTH'
            : 'CONTACT_SALES'
      const plan = (
        code: string,
        minimumActiveUsers: number,
        maximumActiveUsers: number | null,
        userBand: string,
        priceBasis: string,
        cardRequired: boolean,
        ctaLabel: string,
      ) => ({
        code,
        // Localized display name from the catalog — deliberately NOT the enum code, so a
        // regression that renders the raw code to visitors fails these assertions.
        name: ({
          FREE: 'Free',
          STARTER: 'Starter',
          GROWTH: 'Growth',
          CONTACT_SALES: 'Contact Sales',
        } as Record<string, string>)[code],
        minimumActiveUsers,
        maximumActiveUsers,
        monthlyPricePerActiveUserCents: code === 'FREE' ? 0 : null,
        currency: 'USD',
        userBand,
        priceBasis,
        cardRequired,
        availability: code === 'CONTACT_SALES' ? 'ASSISTED' : 'SELF_SERVICE_WHEN_ENABLED',
        ctaLabel,
        materialTerms: ['Cancel at any time'],
        capabilities: [
          {
            code: 'WORKING_DAY_TRANSPARENCY',
            label: 'Working-day transparency',
            availability: 'AVAILABLE',
            presentation: 'INCLUDED',
            checkoutEligible: code !== 'CONTACT_SALES',
          },
        ],
      })
      return new Response(JSON.stringify({
        intendedCount: count,
        locale: url.searchParams.get('locale') ?? 'en',
        recommendedPlan,
        registrationEnabled: false,
        plans: [
          plan('FREE', 1, 5, '1-5 active Users', '$0 forever', false, 'Start Free'),
          plan('STARTER', 6, 50, '6-50 active Users', '$3 per active User / month', true, 'Choose Starter'),
          plan('GROWTH', 51, 200, '51-200 active Users', '$6 per active User / month', true, 'Choose Growth'),
          plan('CONTACT_SALES', 201, null, 'More than 200 active Users', 'Assisted plan', false, 'Contact Sales'),
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

  const bandCases = [
    { count: 5, plan: 'FREE', name: 'Free', card: 'plan-card-free', cta: 'cta-start-free' },
    { count: 6, plan: 'STARTER', name: 'Starter', card: 'plan-card-starter', cta: 'cta-choose-starter' },
    { count: 50, plan: 'STARTER', name: 'Starter', card: 'plan-card-starter', cta: 'cta-choose-starter' },
    { count: 51, plan: 'GROWTH', name: 'Growth', card: 'plan-card-growth', cta: 'cta-choose-growth' },
    { count: 200, plan: 'GROWTH', name: 'Growth', card: 'plan-card-growth', cta: 'cta-choose-growth' },
    { count: 201, plan: 'CONTACT_SALES', name: 'Contact Sales', card: 'plan-card-contact-sales', cta: 'cta-contact-sales' },
  ] as const

  it.each(bandCases)(
    '[P0] Given intendedCount=$count, When recommendation renders, Then $plan is recommended',
    async ({ count, plan, name, card, cta }) => {
      const user = userEvent.setup()
      render(<PricingRecommendation locale="en" registrationEnabled={false} />)

      await user.clear(screen.getByTestId('pricing-intended-count'))
      await user.type(screen.getByTestId('pricing-intended-count'), String(count))

      await waitFor(() => expect(screen.getByTestId(card)).toHaveAttribute('data-recommended', 'true'))
      expect(screen.getByTestId(cta)).toBeVisible()

      const recommendation = screen.getByTestId('pricing-recommended-plan')
      // The machine code stays available to automation, but visitors read the name.
      expect(recommendation).toHaveAttribute('data-plan', plan)
      expect(recommendation).toHaveTextContent(name)
      expect(recommendation).not.toHaveTextContent(plan.replace('_', ''))
      expect(screen.queryByText(/INTERNAL/i)).not.toBeInTheDocument()
    },
  )

  it('[P0] Given each comparison unit, When Pricing renders, Then availability sits inside the card with band, price, terms and CTA (AC1/L1)', async () => {
    const user = userEvent.setup()
    render(<PricingRecommendation locale="en" registrationEnabled={false} />)

    await user.clear(screen.getByTestId('pricing-intended-count'))
    await user.type(screen.getByTestId('pricing-intended-count'), '6')
    await screen.findByTestId('plan-card-starter')

    for (const card of ['free', 'starter', 'growth', 'contact-sales']) {
      const availability = screen.getByTestId(`plan-card-${card}-availability`)
      expect(screen.getByTestId(`plan-card-${card}`)).toContainElement(availability)
      // Conveyed as text, not colour alone.
      expect(availability.textContent?.trim()).toBeTruthy()
    }

    expect(screen.getByTestId('plan-card-contact-sales-availability'))
      .toHaveAttribute('data-availability', 'ASSISTED')
    expect(screen.getByTestId('plan-card-starter-availability'))
      .toHaveAttribute('data-availability', 'SELF_SERVICE_WHEN_ENABLED')
  })

  it('[P1] Given the count is cleared, When no valid count remains, Then the stale recommendation is withdrawn rather than left standing', async () => {
    const user = userEvent.setup()
    render(<PricingRecommendation locale="en" registrationEnabled={false} />)

    await user.clear(screen.getByTestId('pricing-intended-count'))
    await user.type(screen.getByTestId('pricing-intended-count'), '51')
    await screen.findByTestId('plan-card-growth')
    expect(screen.getByTestId('pricing-recommended-plan')).toHaveAttribute('data-plan', 'GROWTH')

    await user.clear(screen.getByTestId('pricing-intended-count'))

    await waitFor(() =>
      expect(screen.queryByTestId('pricing-recommended-plan')).not.toBeInTheDocument())
    expect(screen.queryByTestId('plan-card-growth')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pricing-availability-fallback')).not.toBeInTheDocument()
  })

  it('[P0] Given registration disabled, When CTA fallback shows, Then plan/count/locale are preserved and workspace is never claimed', async () => {
    const user = userEvent.setup()
    render(<PricingRecommendation locale="ar" registrationEnabled={false} />)

    await user.clear(screen.getByTestId('pricing-intended-count'))
    await user.type(screen.getByTestId('pricing-intended-count'), '50')

    const fallback = await screen.findByTestId('pricing-availability-fallback')
    expect(fallback).toHaveAttribute('data-plan', 'STARTER')
    expect(fallback).toHaveAttribute('data-intended-count', '50')
    expect(fallback).toHaveAttribute('data-locale', 'ar')
    expect(screen.queryByText(/workspace (was )?created/i)).not.toBeInTheDocument()
  })

  it('[P1] Given keyboard-only use, When Tab reaches the recommended CTA, Then Enter activates without mouse', async () => {
    const user = userEvent.setup()
    render(<PricingRecommendation locale="en" registrationEnabled={false} />)

    await user.clear(screen.getByTestId('pricing-intended-count'))
    await user.type(screen.getByTestId('pricing-intended-count'), '6')
    await screen.findByTestId('cta-choose-starter')
    await user.tab()

    // Walk focus until the Starter CTA; assert it is keyboard-activatable.
    let focusedName = document.activeElement?.getAttribute('data-testid')
    for (let i = 0; i < 20 && focusedName !== 'cta-choose-starter'; i++) {
      await user.tab()
      focusedName = document.activeElement?.getAttribute('data-testid')
    }
    expect(focusedName).toBe('cta-choose-starter')
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('pricing-availability-fallback')).toBeVisible()
  })
})
