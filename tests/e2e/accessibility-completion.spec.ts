import { expect, test } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'

import { loginViaUi, navigateInApp } from '../support/helpers/auth'
import { mockAuthenticatedOnboarding, onboardingResponse } from '../support/helpers/onboarding'
import { tags } from '../support/tags'

const password = process.env.E2E_USER_PASSWORD ?? 'PilotDev123!'

/**
 * Story 10.10 — sparse behavioral E2E for skip link and mobile drawer focus scope.
 */
test.describe(
  'Accessibility completion — Story 10.10',
  { tag: [tags.regression, tags.uiOnly, tags.story('10-10')] },
  () => {
    test.skip(
      process.env.E2E_API_AVAILABLE !== 'true',
      'Set E2E_API_AVAILABLE=true when ibiza-api is running for authenticated shell navigation',
    )

    test('[P1] Skip link moves focus to main content', async ({ page }) => {
      await loginViaUi(page, { email: 'sarah@company.com', password })
      await navigateInApp(page, '/')

      await page.keyboard.press('Tab')

      const skipLink = page.getByRole('link', { name: /skip to main/i })
      await expect(skipLink).toBeFocused()

      await page.keyboard.press('Enter')

      const main = page.locator('#main-content')
      await expect(main).toBeFocused()
    })

    test('[P0] Mobile drawer constrains focus away from header actions', async ({ page }) => {
      await loginViaUi(page, { email: 'jordan@company.com', password })
      await page.setViewportSize({ width: 390, height: 844 })
      await navigateInApp(page, '/')

      await page.getByTestId('shell-topbar-menu').click()
      await expect(page.getByTestId('sidebar')).toBeVisible()

      const bell = page.getByTestId('notification-bell')
      const userMenu = page.getByTestId('user-menu-trigger')

      const assertHeaderActionNotFocused = async (label: string) => {
        const focused = await page.evaluate(() => {
          const active = document.activeElement
          return active?.getAttribute('data-testid') ?? active?.tagName ?? ''
        })
        expect(
          focused,
          `${label} must not receive focus while the mobile drawer is open (focused: ${focused})`,
        ).not.toMatch(/notification-bell|user-menu-trigger/)
      }

      // Cycle Tab from the first focused nav link through the drawer trap.
      for (let step = 0; step < 12; step += 1) {
        await assertHeaderActionNotFocused('Header action')
        await page.keyboard.press('Tab')
      }

      await expect(bell).toBeVisible()
      await expect(userMenu).toBeVisible()
      await expect(bell).not.toBeFocused()
      await expect(userMenu).not.toBeFocused()
    })
  },
)

/*
 * Epic 12 accessibility checkpoints — Stories 12.3, 12.4 and 12.5.
 *
 * Closes Epic 12 retrospective action item 16 / gate qualification Q2. Those three stories each
 * carry the identical AC clause "keyboard-only use, visible focus, ... 200% zoom, 400% reflow,
 * reduced motion, 44px targets", and each left it unchecked because no spec asserted any of it.
 * Story 12.1's public matrix genuinely covers that ground, but it exercises the public shell —
 * not the registration form, the Checkout-return panel, or the guided-onboarding page rendered
 * inside it. Inferring the other three from it would be the "declared coverage that does not
 * execute" pattern the retrospective raised, so the surfaces are asserted directly here.
 *
 * One parameterised contract runs against all three, because the AC clause is identical: a
 * surface that renders, a primary control that keyboard reaches with a visible focus ring, no
 * page-level horizontal overflow at 200% zoom or 400% reflow, a transition that collapses under
 * reduced motion, and no rendered control below the 44px target floor.
 *
 * Dependency tag is @ui-only: every surface is reachable with route mocks alone, so these run in
 * `npm run test:e2e:ui-only` and in `--grep @regression` without ibiza-api.
 */

const publicBaseUrl = process.env.PUBLIC_BASE_URL ??
  (process.env.E2E_PUBLIC_ARTIFACT === 'true'
    ? 'http://127.0.0.1:4174'
    : process.env.BASE_URL ?? 'http://localhost:5173')

// tokens.css --min-touch-target. Asserted at the touch viewport, where the floor is the point.
const MIN_TARGET_PX = 44

/*
 * 1280x900 is the desktop baseline the Epic 12 layout matrices already use. Browser zoom at N%
 * lays the page out at (baseline / N) CSS pixels, which is exactly what a narrowed viewport with
 * a matching deviceScaleFactor emulates — Playwright exposes no browser-zoom control.
 *
 * Deliberately NOT emulated by scaling the root font-size: the typography tokens are px-based
 * (`--font-body-size: 15px`), so text-only zoom does not move them and such an assertion would
 * pass no matter what shipped. WCAG 1.4.4 is met through browser zoom in a px-based design, and
 * 1.4.10 Reflow names 320 CSS px as its floor — 1280 at 400%.
 */
const ZOOM_200 = { viewport: { width: 640, height: 450 }, deviceScaleFactor: 2 }
const REFLOW_400 = { viewport: { width: 320, height: 225 }, deviceScaleFactor: 4 }
const TOUCH_VIEWPORT = { viewport: { width: 390, height: 844 } }

type Surface = {
  story: '12-3' | '12-4' | '12-5'
  suite: string
  what: string
  baseURL?: string
  path: string
  /** Route mocks / authentication the surface needs before its first navigation. */
  prepare?: (context: BrowserContext) => Promise<void>
  /** Proves the surface itself rendered, not merely the shell around it. */
  anchor: string
  /** The control the AC clause requires a keyboard-only visitor to reach and see focused. */
  primaryAction: string
}

/**
 * The Checkout-return page reads status, recoveryAction, selectedPlan and intendedCount and
 * derives its single safe next action from them. ACTION_REQUIRED + RESUME_CHECKOUT is chosen
 * because it is the state that renders an actionable control — a terminal state with no action
 * would leave the keyboard and target-size checks with nothing to assert against.
 */
const checkoutReturnState = {
  registrationId: 'reg-a11y',
  status: 'ACTION_REQUIRED',
  selectedPlan: 'GROWTH',
  intendedCount: 12,
  maskedEmail: 'p****@example.com',
  organizationName: 'Priya Agency',
  locale: 'en',
  country: 'US',
  timezone: 'America/New_York',
  recoveryAction: 'RESUME_CHECKOUT',
  checkoutSessionId: 'cs_a11y',
}

const surfaces: Surface[] = [
  {
    story: '12-3',
    suite: 'Free registration accessibility checkpoints — Story 12.3',
    what: 'the Free registration form',
    baseURL: publicBaseUrl,
    path: '/register?plan=FREE&intendedCount=3',
    anchor: 'register-plan-summary',
    primaryAction: 'register-submit',
  },
  {
    story: '12-4',
    suite: 'Paid Checkout return accessibility checkpoints — Story 12.4',
    what: 'the paid Checkout-return recovery panel',
    baseURL: publicBaseUrl,
    path: '/register/checkout-return?registrationId=reg-a11y&outcome=success&plan=GROWTH',
    prepare: async (context) => {
      await context.route('**/api/v1/registrations/reg-a11y', (route) =>
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(checkoutReturnState),
        }),
      )
    },
    anchor: 'checkout-return-confirming',
    primaryAction: 'recovery-next-action',
  },
  {
    story: '12-5',
    suite: 'Guided onboarding accessibility checkpoints — Story 12.5',
    what: 'the guided onboarding page',
    path: '/onboarding',
    prepare: async (context) => {
      await mockAuthenticatedOnboarding(context, () => onboardingResponse())
    },
    anchor: 'onboarding-page',
    primaryAction: 'onboarding-next-action',
  },
]

/**
 * The public shell mounts its Privacy Choices panel over the page. Dismissing it keeps the
 * checkpoints aimed at the surface under test rather than at consent chrome that Story 12.1
 * already covers. Tolerant by design: the app shell has no such panel.
 */
async function dismissConsentPanel(page: Page): Promise<void> {
  const necessary = page.getByTestId('consent-necessary')
  if (await necessary.count() > 0 && await necessary.first().isVisible()) {
    await necessary.first().click()
  }
}

async function openSurface(context: BrowserContext, surface: Surface): Promise<Page> {
  const page = await context.newPage()
  await page.goto(surface.path)
  await expect(page.getByTestId(surface.anchor)).toBeVisible()
  await dismissConsentPanel(page)
  return page
}

async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(
    layout.documentWidth,
    `${label}: page-level horizontal overflow (${layout.documentWidth}px in ${layout.viewport}px)`,
  ).toBeLessThanOrEqual(layout.viewport + 1)
}

/**
 * Reflow's real failure mode is content the visitor cannot reach, and `scrollWidth` cannot see
 * it: an element pushed past the viewport inside an ancestor that clips never enlarges the
 * document's scroll area, so the page-level check stays green while the content is gone.
 * Measured on `/register` at a 50px viewport, `documentElement.scrollWidth` reported 50 while a
 * `.btn.public-login` sat at right=153 — clipped, not scrollable. Both assertions are kept: one
 * proves the page does not scroll sideways, this one proves nothing was cut off to achieve that.
 */
async function expectContentWithinViewport(page: Page, label: string): Promise<void> {
  const escaping = await page.evaluate(() => {
    const viewport = window.innerWidth
    const offenders = new Set<string>()
    for (const element of document.querySelectorAll<HTMLElement>('body *')) {
      const style = getComputedStyle(element)
      // Fixed and sticky chrome is painted against the viewport rather than laid out in flow;
      // it creates no document scroll and is not what reflow is about.
      if (style.position === 'fixed' || style.position === 'sticky') continue
      if (style.visibility === 'hidden' || style.display === 'none') continue
      const rect = element.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      if (rect.right > viewport + 1) {
        const name = element.dataset.testid ?? element.getAttribute('class') ?? element.tagName
        offenders.add(`${element.tagName.toLowerCase()}[${name}] right=${rect.right.toFixed(1)}`)
      }
    }
    return [...offenders].slice(0, 8)
  })
  expect(
    escaping,
    `${label}: content is laid out past the viewport edge and clipped out of reach`,
  ).toEqual([])
}

/**
 * The Turnstile widget is injected by a third-party script after first paint, and it is the
 * widest thing the registration form contains. Measuring reflow before it lands measures a form
 * that is missing its largest child: that is precisely how this assertion passed locally, where
 * the fetch to Cloudflare lost the race, while failing in CI where it won — the layout defect was
 * real the whole time and the suite reported it only on the faster network.
 *
 * Bounded and tolerant on purpose. A surface without a widget returns at once, and a run that
 * cannot reach Cloudflare proceeds rather than turning an unreachable third party into an
 * accessibility failure.
 */
async function settleTurnstile(page: Page): Promise<void> {
  const holder = page.locator('[data-action="registration"]')
  if ((await holder.count()) === 0) return
  // Waiting for the child element to attach is NOT enough: render() inserts an empty wrapper
  // synchronously and the widget takes its size a frame or more later, so an attachment wait
  // still measures a 0x0 box — which the offender scan skips, passing on the very layout it
  // exists to catch. Height becoming non-zero is the first moment the widget occupies space.
  await holder.first().evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        const deadline = Date.now() + 5_000
        const poll = () => {
          if (element.getBoundingClientRect().height > 0 || Date.now() > deadline) resolve()
          else requestAnimationFrame(poll)
        }
        poll()
      }),
  )
}

for (const surface of surfaces) {
  test.describe(
    surface.suite,
    { tag: [tags.regression, tags.uiOnly, tags.story(surface.story)] },
    () => {
      // Each surface runs only in the topology that serves it, and neither topology serves both.
      // The customer app is absent from the public-artifact preview; the public pages are absent
      // from the SPA preview, because `npm run preview` (scripts/serve-spa-artifacts.mjs) serves
      // dist/app and dist/admin only.
      //
      // The second guard was missing, and the gap was invisible locally: `npm run dev` is a plain
      // Vite server that resolves both entries on one port, so /register rendered. Under CI the
      // config switches to `npm run preview`, publicBaseUrl falls back to BASE_URL (there is no
      // PUBLIC_BASE_URL and E2E_PUBLIC_ARTIFACT is unset), and the two public surfaces navigated
      // to an origin with no such route -- 4 failures the first time these jobs ever executed.
      // This mirrors the guard paid-registration.spec.ts and public-entry-boundaries.spec.ts
      // already carry, which is why their @ui-only tests skip rather than fail in that job.
      test.skip(
        surface.story === '12-5' && process.env.E2E_PUBLIC_ARTIFACT === 'true',
        'The guided onboarding page belongs to the customer app, not the public artifact',
      )
      test.skip(
        surface.story !== '12-5' && process.env.E2E_PUBLIC_ARTIFACT !== 'true',
        'The public registration surfaces are served only by the public artifact; run npm run test:e2e:public',
      )

      test(
        `[P0] Given a keyboard, zoom, reflow, reduced-motion or touch visitor, When ${surface.what} renders, Then every accessibility checkpoint holds`,
        async ({ browser, browserName }) => {
          const contextOptions = surface.baseURL ? { baseURL: surface.baseURL } : {}

          // WebKit on macOS only tabs between form fields unless Full Keyboard Access is on, a
          // system setting Playwright cannot reach; Option+Tab is the sequence that walks links
          // and buttons there. Same convention as public-entry-boundaries.spec.ts. Pressing plain
          // Tab under webkit would fail on Safari's default, not on anything this page ships.
          const advanceFocus = browserName === 'webkit' ? 'Alt+Tab' : 'Tab'

          // Keyboard-only reach and a visible focus indicator.
          const keyboardContext = await browser.newContext(contextOptions)
          await surface.prepare?.(keyboardContext)
          const keyboardPage = await openSurface(keyboardContext, surface)
          const primary = keyboardPage.getByTestId(surface.primaryAction)
          await expect(primary).toBeVisible()

          let reached = false
          for (let stop = 0; stop < 40 && !reached; stop += 1) {
            await keyboardPage.keyboard.press(advanceFocus)
            reached = await primary.evaluate((element) => element === document.activeElement)
          }
          expect(
            reached,
            `${surface.what}: ${surface.primaryAction} was not reachable by ${advanceFocus} within 40 stops`,
          ).toBe(true)

          // global.css draws :focus-visible as a box-shadow ring with `outline: none`, so an
          // outline assertion would report a false failure here and a box-shadow of `none` is
          // the real regression.
          const focusRing = await primary.evaluate(
            (element) => getComputedStyle(element).boxShadow,
          )
          expect(
            focusRing,
            `${surface.what}: ${surface.primaryAction} shows no focus ring while keyboard-focused`,
          ).not.toBe('none')

          // An unnamed control is unusable to a screen-reader user even when it is reachable.
          const accessibleName = (await primary.evaluate(
            (element) => element.getAttribute('aria-label') ?? element.textContent ?? '',
          )).trim()
          expect(
            accessibleName.length,
            `${surface.what}: ${surface.primaryAction} has no accessible name`,
          ).toBeGreaterThan(0)
          await keyboardContext.close()

          // 200% browser zoom and 400% reflow.
          for (const [label, emulation] of [
            ['200% zoom', ZOOM_200],
            ['400% reflow', REFLOW_400],
          ] as const) {
            const zoomContext = await browser.newContext({ ...contextOptions, ...emulation })
            await surface.prepare?.(zoomContext)
            const zoomPage = await openSurface(zoomContext, surface)
            await expect(
              zoomPage.getByTestId(surface.anchor),
              `${surface.what} at ${label}: the surface stopped rendering`,
            ).toBeVisible()
            await expect(
              zoomPage.getByTestId(surface.primaryAction),
              `${surface.what} at ${label}: the primary action was lost`,
            ).toBeVisible()
            await settleTurnstile(zoomPage)
            await expectNoHorizontalOverflow(zoomPage, `${surface.what} at ${label}`)
            await expectContentWithinViewport(zoomPage, `${surface.what} at ${label}`)
            await zoomContext.close()
          }

          // Reduced motion collapses transitions rather than merely matching the query.
          const reducedContext = await browser.newContext({
            ...contextOptions,
            reducedMotion: 'reduce',
          })
          await surface.prepare?.(reducedContext)
          const reducedPage = await openSurface(reducedContext, surface)
          const reduced = await reducedPage.getByTestId(surface.primaryAction).evaluate(
            (element) => ({
              matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
              transitionDuration: getComputedStyle(element).transitionDuration,
            }),
          )
          expect(reduced.matches, `${surface.what}: reduced-motion query did not match`).toBe(true)
          expect(
            parseFloat(reduced.transitionDuration),
            `${surface.what}: transition did not collapse under reduced motion`,
          ).toBeLessThanOrEqual(0.01)
          await reducedContext.close()

          // Target size at the touch viewport.
          const touchContext = await browser.newContext({ ...contextOptions, ...TOUCH_VIEWPORT })
          await surface.prepare?.(touchContext)
          const touchPage = await openSurface(touchContext, surface)
          const undersized = await touchPage.evaluate((minimum) => {
            // WCAG 2.5.8 exempts links inside a block of text, so only controls are measured:
            // buttons, .btn links and form fields — exactly what tokens.css sizes with
            // --min-touch-target. The Checkout-return page's inline "exit" link is out of scope
            // for that reason, and measuring it would be a false failure.
            const controls = document.querySelectorAll<HTMLElement>(
              'button, a.btn, input:not([type="hidden"]), select, textarea',
            )
            const failures: string[] = []
            for (const control of controls) {
              const style = getComputedStyle(control)
              if (style.visibility === 'hidden' || style.display === 'none') continue
              const rect = control.getBoundingClientRect()
              if (rect.width === 0 && rect.height === 0) continue
              // Sub-pixel layout can land a 44px control on 43.99.
              if (rect.width + 0.5 < minimum || rect.height + 0.5 < minimum) {
                const name = control.dataset.testid ?? control.getAttribute('class') ?? control.tagName
                failures.push(`${name} ${rect.width.toFixed(1)}x${rect.height.toFixed(1)}`)
              }
            }
            return failures
          }, MIN_TARGET_PX)
          expect(
            undersized,
            `${surface.what}: controls below the ${MIN_TARGET_PX}px target floor`,
          ).toEqual([])
          await expectNoHorizontalOverflow(touchPage, `${surface.what} at 390px`)
          await touchContext.close()
        },
      )
    },
  )
}
