import { describe, expect, it } from 'vitest'
import { renderPublicRoute } from '../../entries/public-render'
import { PUBLIC_ROUTE_PATHS, resolvePublicRoute } from './publicRoutes'

// PUBLIC-VAL-001 — per-route metadata. scripts/verify-public-output.mjs asserts the
// same properties on the built documents; this suite pins them at the source so a
// regression fails in `npm run test:ci` rather than only at build time.

const LOCALES = ['en', 'ar'] as const

describe('Public route metadata — Story 12.1', () => {
  it('[P0] gives every indexable route a non-empty title and description in both locales', () => {
    for (const locale of LOCALES) {
      for (const route of PUBLIC_ROUTE_PATHS) {
        const { title, description } = renderPublicRoute(locale, route)
        expect(title.trim(), `${locale} ${route} title`).not.toBe('')
        expect(description.trim(), `${locale} ${route} description`).not.toBe('')
      }
    }
  })

  it('[P0] keeps titles and descriptions unique across routes within a locale', () => {
    for (const locale of LOCALES) {
      const titles = new Set<string>()
      const descriptions = new Set<string>()
      for (const route of PUBLIC_ROUTE_PATHS) {
        const { title, description } = renderPublicRoute(locale, route)
        expect(titles.has(title), `${locale}: duplicate title on ${route}`).toBe(false)
        expect(
          descriptions.has(description),
          `${locale}: duplicate description on ${route}`,
        ).toBe(false)
        titles.add(title)
        descriptions.add(description)
      }
    }
  })

  it('[P0] renders real Arabic copy rather than falling back to the English dictionary', () => {
    for (const route of PUBLIC_ROUTE_PATHS) {
      const en = renderPublicRoute('en', route)
      const ar = renderPublicRoute('ar', route)
      expect(ar.title, `${route} title not localized`).not.toBe(en.title)
      expect(ar.description, `${route} description not localized`).not.toBe(en.description)
      expect(ar.title, `${route} title has no Arabic script`).toMatch(/[؀-ۿ]/)
    }
  })

  it('[P0] emits meaningful pre-hydration markup with one h1 and a main landmark', () => {
    for (const locale of LOCALES) {
      for (const route of PUBLIC_ROUTE_PATHS) {
        const { html } = renderPublicRoute(locale, route)
        expect(html, `${locale} ${route} has no <main>`).toContain('<main')
        expect(
          (html.match(/<h1[\s>]/g) ?? []).length,
          `${locale} ${route} must have exactly one h1`,
        ).toBe(1)
        expect(html.length, `${locale} ${route} markup is too thin`).toBeGreaterThan(500)
      }
    }
  })

  it('[P0] gives the 404 document its own metadata, distinct from every indexable route', () => {
    for (const locale of LOCALES) {
      const notFound = renderPublicRoute(locale, '/404')
      expect(notFound.title.trim()).not.toBe('')
      for (const route of PUBLIC_ROUTE_PATHS) {
        expect(notFound.title, `${locale} /404 title collides with ${route}`).not.toBe(
          renderPublicRoute(locale, route).title,
        )
      }
    }
  })

  it('[P0] resolves each locale-prefixed path back to the route its metadata describes', () => {
    for (const route of PUBLIC_ROUTE_PATHS) {
      expect(resolvePublicRoute(route)).toEqual({ locale: 'en', route })

      const arabicPath = route === '/' ? '/ar' : `/ar${route}`
      expect(resolvePublicRoute(arabicPath)).toEqual({ locale: 'ar', route })
      // Trailing slashes must not spawn a second URL for the same document.
      expect(resolvePublicRoute(`${arabicPath}/`)).toEqual({ locale: 'ar', route })
    }

    expect(resolvePublicRoute('/nope').route).toBe('/404')
    expect(resolvePublicRoute('/ar/nope')).toEqual({ locale: 'ar', route: '/404' })
    // `/arabica` starts with "/ar" but is not the Arabic locale prefix.
    expect(resolvePublicRoute('/arabica').locale).toBe('en')
  })
})
