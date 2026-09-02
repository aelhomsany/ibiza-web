import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PricingRecommendation } from './PricingRecommendation'

/**
 * Story 12.2 SPA-only Pricing UX (SALES-VAL-001–007, keyboard).
 * Band commercial truth stays API-authoritative; these tests cover the rendered
 * comparison, preserved plan/count/locale, and keyboard reach. The page no longer
 * asks for an intended count — visitors size themselves against each card's
 * published band — so the count reaches these assertions as a handoff value only.
 */
describe('PricingRecommendation ATDD — Story 12.2', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost')
      const count = Number(url.searchParams.get('intendedCount'))
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
          GROWTH: 'Growth',
          CONTACT_SALES: 'Contact Sales',
        } as Record<string, string>)[code],
        minimumActiveUsers,
        maximumActiveUsers,
        monthlyPricePerActiveUserCents: code === 'FREE' ? 0 : code === 'GROWTH' ? 100 : null,
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
        recommendedPlan: 'FREE',
        registrationEnabled: false,
        plans: [
          plan('FREE', 1, 5, '1-5 active Users', '$0 forever', false, 'Start Free'),
          plan('GROWTH', 1, 200, '1-200 active Users', '$1 per active User / month', true, 'Choose Growth'),
          plan('CONTACT_SALES', 201, null, 'More than 200 active Users', 'Assisted plan', false, 'Contact Sales'),
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

  // Every catalog plan is published as its own comparison unit, so a visitor reads the band
  // and decides — nothing is asked of them and nothing is hidden behind a chosen count.
  const planCases = [
    { name: 'Free', card: 'plan-card-free', cta: 'cta-start-free', band: '1-5 active Users' },
    { name: 'Growth', card: 'plan-card-growth', cta: 'cta-choose-growth', band: '1-200 active Users' },
    {
      name: 'Contact Sales',
      card: 'plan-card-contact-sales',
      cta: 'cta-contact-sales',
      band: 'More than 200 active Users',
    },
  ] as const

  it('[P0] Given the catalog, When Pricing renders, Then every plan shows its band and CTA without asking for a count', async () => {
    render(<PricingRecommendation locale="en" registrationEnabled={false} />)

    await screen.findByTestId('plan-card-free')
    for (const { name, card, cta, band } of planCases) {
      const unit = screen.getByTestId(card)
      expect(unit).toHaveTextContent(name)
      expect(unit).toHaveTextContent(band)
      expect(unit).toContainElement(screen.getByTestId(cta))
    }

    // The page asks the visitor for nothing: no count field, no complex-needs question.
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pricing-recommended-plan')).not.toBeInTheDocument()
    expect(screen.queryByText(/INTERNAL/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/workspace (was )?created/i)).not.toBeInTheDocument()
  })

  it('[P0] Given each comparison unit, When Pricing renders, Then availability sits inside the card with band, price, terms and CTA (AC1/L1)', async () => {
    render(<PricingRecommendation locale="en" registrationEnabled={false} />)
    await screen.findByTestId('plan-card-growth')

    for (const card of ['free', 'growth', 'contact-sales']) {
      const availability = screen.getByTestId(`plan-card-${card}-availability`)
      expect(screen.getByTestId(`plan-card-${card}`)).toContainElement(availability)
      // Conveyed as text, not colour alone.
      expect(availability.textContent?.trim()).toBeTruthy()
    }

    expect(screen.getByTestId('plan-card-contact-sales-availability'))
      .toHaveAttribute('data-availability', 'ASSISTED')
    expect(screen.getByTestId('plan-card-growth-availability'))
      .toHaveAttribute('data-availability', 'SELF_SERVICE_WHEN_ENABLED')
  })

  it('[P0] Given registration disabled, When CTA fallback shows, Then plan/count/locale are preserved and workspace is never claimed', async () => {
    const user = userEvent.setup()
    render(
      <PricingRecommendation locale="ar" registrationEnabled={false} initialIntendedCount={50} />,
    )

    await user.click(await screen.findByTestId('cta-choose-growth'))

    const fallback = await screen.findByTestId('pricing-availability-fallback')
    expect(fallback).toHaveAttribute('data-plan', 'GROWTH')
    // The entry link's count is carried into the next step even though nothing on the page asks for it.
    expect(fallback).toHaveAttribute('data-intended-count', '50')
    expect(fallback).toHaveAttribute('data-locale', 'ar')
    expect(screen.queryByText(/workspace (was )?created/i)).not.toBeInTheDocument()
  })

  it('[P1] Given the catalog is unreachable, When the request fails, Then Contact Sales stands in rather than a stale price', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    render(<PricingRecommendation locale="en" registrationEnabled={false} />)

    await waitFor(() => expect(screen.queryByTestId('plan-card-free')).not.toBeInTheDocument())
    expect(screen.getAllByRole('link', { name: /contact sales/i }).length).toBeGreaterThan(0)
  })

  it('[P1] Given keyboard-only use, When Tab reaches a plan CTA, Then Enter activates without mouse', async () => {
    const user = userEvent.setup()
    render(<PricingRecommendation locale="en" registrationEnabled={false} />)

    await screen.findByTestId('cta-choose-growth')
    await user.tab()

    // Walk focus until the Growth CTA; assert it is keyboard-activatable.
    let focusedName = document.activeElement?.getAttribute('data-testid')
    for (let i = 0; i < 20 && focusedName !== 'cta-choose-growth'; i++) {
      await user.tab()
      focusedName = document.activeElement?.getAttribute('data-testid')
    }
    expect(focusedName).toBe('cta-choose-growth')
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('pricing-availability-fallback')).toBeVisible()
  })
})
