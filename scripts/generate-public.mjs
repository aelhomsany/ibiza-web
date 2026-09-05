import { createHash } from 'node:crypto'
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const projectRoot = resolve(import.meta.dirname, '..')
const outputRoot = join(projectRoot, 'dist/public')
const ssrRoot = join(projectRoot, '.public-ssr')
const templatePath = join(outputRoot, 'public.html')
const siteUrl = (process.env.PUBLIC_SITE_URL ?? 'https://www.leaveo.net').replace(/\/+$/, '')
const configuredApiUrl = process.env.PUBLIC_API_ORIGIN ?? process.env.VITE_API_URL
const apiOrigin = configuredApiUrl
  ? new URL(configuredApiUrl).origin.replace(/\/+$/, '')
  : undefined

const renderer = await import(pathToFileURL(join(ssrRoot, 'public-render.js')).href)
const template = readFileSync(templatePath, 'utf8')
const publicRoutes = renderer.PUBLIC_ROUTE_PATHS
const indexableRoutes = renderer.PUBLIC_INDEXABLE_ROUTE_PATHS
const taskRoutes = new Set(renderer.PUBLIC_TASK_ROUTE_PATHS)

function localePath(locale, route) {
  if (locale === 'ar') return route === '/' ? '/ar/' : `/ar${route}`
  return route
}

function outputPath(locale, route) {
  const pathname = localePath(locale, route)
  if (pathname === '/') return join(outputRoot, 'index.html')
  return join(outputRoot, pathname.replace(/^\/|\/$/g, ''), 'index.html')
}

function absoluteUrl(locale, route) {
  return `${siteUrl}${localePath(locale, route)}`
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function createStructuredData(locale, route, description) {
  if (route !== '/') return null
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Leaveo',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: locale,
    description,
    url: absoluteUrl(locale, route),
  })
}

function cspFor(structuredData, allowTurnstile = false) {
  const turnstileOrigin = 'https://challenges.cloudflare.com'
  const connectSources = [
    "'self'",
    ...(apiOrigin ? [apiOrigin] : []),
    ...(allowTurnstile ? [turnstileOrigin] : []),
  ]
  const scriptSources = ["'self'", ...(allowTurnstile ? [turnstileOrigin] : [])]
  if (structuredData) {
    const hash = createHash('sha256').update(structuredData).digest('base64')
    scriptSources.push(`'sha256-${hash}'`)
  }
  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'none'",
    `connect-src ${connectSources.join(' ')}`,
    ...(allowTurnstile ? [`frame-src ${turnstileOrigin}`] : ["frame-src 'none'"]),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // frame-ancestors is deliberately absent: browsers ignore it in a <meta> CSP and
    // log an error. It is declared in deployment.json responseHeaders instead, where
    // the host can actually enforce it.
    ...(siteUrl.startsWith('https://') ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
}

function generateDocument(locale, route, { noindex = false } = {}) {
  const rendered = renderer.renderPublicRoute(locale, route)
  const canonicalRoute = route === '/404' ? '/' : route
  const canonical = absoluteUrl(locale, canonicalRoute)
  const english = absoluteUrl('en', canonicalRoute)
  const arabic = absoluteUrl('ar', canonicalRoute)
  const structuredData = createStructuredData(
    locale,
    route,
    rendered.description,
  )
  const metadata = [
    `<meta name="description" content="${escapeAttribute(rendered.description)}" />`,
    noindex ? '<meta name="robots" content="noindex, nofollow" />' : '',
    `<link rel="canonical" href="${escapeAttribute(canonical)}" />`,
    `<link rel="alternate" hreflang="en" href="${escapeAttribute(english)}" />`,
    `<link rel="alternate" hreflang="ar" href="${escapeAttribute(arabic)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${escapeAttribute(english)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="Leaveo" />`,
    `<meta property="og:locale" content="${locale === 'ar' ? 'ar_AR' : 'en_US'}" />`,
    `<meta property="og:title" content="${escapeAttribute(rendered.title)}" />`,
    `<meta property="og:description" content="${escapeAttribute(rendered.description)}" />`,
    `<meta property="og:url" content="${escapeAttribute(canonical)}" />`,
    '<meta name="twitter:card" content="summary" />',
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(cspFor(structuredData, route === '/contact-sales' || route.startsWith('/register')))}" />`,
    structuredData
      ? `<script type="application/ld+json">${structuredData}</script>`
      : '',
  ]
    .filter(Boolean)
    .join('\n    ')

  // Replacements are supplied as functions: in the replacement *string* position `$&`,
  // "$`", `$'` and `$$` are substitution directives, so any copy containing one would
  // splice parts of the template into the output. escapeAttribute does not neutralise `$`.
  return template
    .replace(/<html[^>]*>/, () => `<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">`)
    .replace(
      /<title>[\s\S]*?<\/title>/,
      () => `<title>${escapeAttribute(rendered.title)} | Leaveo</title>\n    ${metadata}`,
    )
    .replace(
      '<div id="public-document"></div>',
      () => `<div id="public-document">${rendered.html}</div>`,
    )
}

for (const locale of ['en', 'ar']) {
  for (const route of publicRoutes) {
    const destination = outputPath(locale, route)
    mkdirSync(dirname(destination), { recursive: true })
    writeFileSync(destination, generateDocument(locale, route, { noindex: taskRoutes.has(route) }))
  }
}

writeFileSync(
  join(outputRoot, '404.html'),
  generateDocument('en', '/404', { noindex: true }),
)
mkdirSync(join(outputRoot, 'ar'), { recursive: true })
writeFileSync(
  join(outputRoot, 'ar/404.html'),
  generateDocument('ar', '/404', { noindex: true }),
)

const sitemapUrls = indexableRoutes.flatMap((route) =>
  ['en', 'ar'].map((locale) => {
    const location = absoluteUrl(locale, route)
    const alternates = [
      `<xhtml:link rel="alternate" hreflang="en" href="${absoluteUrl('en', route)}" />`,
      `<xhtml:link rel="alternate" hreflang="ar" href="${absoluteUrl('ar', route)}" />`,
      `<xhtml:link rel="alternate" hreflang="x-default" href="${absoluteUrl('en', route)}" />`,
    ].join('')
    return `<url><loc>${location}</loc>${alternates}<lastmod>2026-08-01</lastmod></url>`
  }),
)

writeFileSync(
  join(outputRoot, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${sitemapUrls.join('')}</urlset>\n`,
)
writeFileSync(
  join(outputRoot, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
)
writeFileSync(
  join(outputRoot, 'deployment.json'),
  JSON.stringify(
    {
      artifact: 'leaveo-public',
      entry: 'index.html',
      fallback: null,
      unknownRouteStatus: 404,
      environmentAllowlist: [
        'VITE_API_URL',
        'VITE_PUBLIC_ANALYTICS_ENABLED',
        'VITE_PUBLIC_APP_BASE_URL',
        'VITE_PUBLIC_CTA_ENABLED',
        'VITE_PUBLIC_TURNSTILE_SITE_KEY',
      ],
      csp: 'document-specific meta policy with hashed structured data',
      // Directives a <meta> CSP cannot carry. The host/CDN must send these; the
      // preview server in scripts/serve-public.mjs mirrors them so the contract is
      // exercised locally rather than only asserted on paper.
      responseHeaders: {
        'Content-Security-Policy': "frame-ancestors 'none'",
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
    null,
    2,
  ),
)

rmSync(templatePath)
rmSync(ssrRoot, { recursive: true, force: true })
