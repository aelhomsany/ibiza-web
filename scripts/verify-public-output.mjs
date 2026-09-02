import { brotliCompressSync } from 'node:zlib'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../dist/public')

// Vite reads .env for the build itself, but this is a plain Node script, so `process.env` did not
// see it — which made the fail-closed check below fire even for a developer who had done exactly
// what .env.example tells them to do ("Copying this file to .env is enough to make a local build
// work"). Load it here so the check reads the same environment the bundle was built with. Real
// environment variables already set win, as they do in Vite.
const dotenv = resolve(import.meta.dirname, '../.env')
if (existsSync(dotenv)) process.loadEnvFile(dotenv)
const routes = [
  '',
  'product',
  'distributed-teams',
  'working-day-transparency',
  'security',
  'pricing',
  'contact-sales',
  'privacy',
  'terms',
]
const taskRoutes = ['register', 'register/verify', 'register/recovery']
const locales = ['', 'ar']
const errors = []
const titles = new Set()
const descriptions = new Set()

function check(condition, message) {
  if (!condition) errors.push(message)
}

// Contact Sales posts whatever the Cloudflare widget wrote into `cf-turnstile-response`.
// Without a site key the widget script is never injected, that field never exists, and the
// API rejects every real submission on @NotBlank — a total, silent outage of the assisted
// path behind a generic "check your entries" message. Fail the build instead of shipping it.
const turnstileSiteKey = process.env.VITE_PUBLIC_TURNSTILE_SITE_KEY ?? ''
check(
  turnstileSiteKey.trim().length > 0,
  'VITE_PUBLIC_TURNSTILE_SITE_KEY is unset: the Turnstile widget would never render and '
    + 'every Contact Sales submission would be rejected. Set it before building dist/public.',
)

for (const locale of locales) {
  for (const route of routes) {
    const path = join(root, locale, route, 'index.html')
    check(existsSync(path), `Missing public document: ${path}`)
    if (!existsSync(path)) continue
    const html = readFileSync(path, 'utf8')
    const title = html.match(/<title>(.*?)<\/title>/)?.[1]
    const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1]
    check(Boolean(title), `${path}: missing title`)
    check(Boolean(description), `${path}: missing description`)
    check(!titles.has(title), `${path}: duplicate title ${title}`)
    check(!descriptions.has(description), `${path}: duplicate description`)
    titles.add(title)
    descriptions.add(description)
    check(/<main id="public-main"/.test(html), `${path}: missing semantic main`)
    check(/<h1>/.test(html), `${path}: missing h1`)
    check(
      /data-testid="working-day-proof"/.test(html) ||
        /security|privacy|terms/.test(route) ||
        (route === 'pricing' && /pricing-experience/.test(html)) ||
        (route === 'contact-sales' && /contact-sales-follow-up-consent/.test(html)),
      `${path}: evidence absent`,
    )
    check(/rel="canonical"/.test(html), `${path}: canonical absent`)
    check(/hreflang="en"/.test(html), `${path}: English alternate absent`)
    check(/hreflang="ar"/.test(html), `${path}: Arabic alternate absent`)
    check(/hreflang="x-default"/.test(html), `${path}: x-default absent`)
    check(/Content-Security-Policy/.test(html), `${path}: CSP absent`)
    check(/data-testid="consent-necessary"/.test(html), `${path}: static consent absent`)
    check(
      locale === 'ar'
        ? /<html lang="ar" dir="rtl">/.test(html)
        : /<html lang="en" dir="ltr">/.test(html),
      `${path}: document language/direction mismatch`,
    )
    check(!/INTERNAL/.test(html), `${path}: internal plan leaked`)
    if (route === 'pricing') {
      check(/authoritative|المعتمد/.test(html), `${path}: catalog authority marker absent`)
      check(/pricing-recovery/.test(html), `${path}: safe catalog fallback absent`)
    }
    if (route === 'contact-sales') {
      check(/contact-sales-submit/.test(html), `${path}: Contact Sales form absent`)
      check(/does not create a workspace|لا ينشئ مساحة عمل/.test(html), `${path}: no-workspace boundary absent`)
    }
    check(!/AuthProvider|\/api\/v1\/auth\/refresh|\/api\/v1\/auth\/me/.test(html), `${path}: auth boundary leaked`)
  }
}

for (const locale of locales) {
  for (const route of taskRoutes) {
    const path = join(root, locale, route, 'index.html')
    check(existsSync(path), `Missing public task document: ${path}`)
    if (!existsSync(path)) continue
    const html = readFileSync(path, 'utf8')
    check(/noindex, nofollow/.test(html), `${path}: registration task must be noindex`)
    check(/registration-island/.test(html), `${path}: registration task surface absent`)
    check(/data-action="registration"/.test(html) || route !== 'register', `${path}: registration Turnstile action absent`)
    check(!/AuthProvider|\/api\/v1\/auth\/refresh|\/api\/v1\/auth\/me/.test(html), `${path}: auth boundary leaked`)
  }
}

const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8')
check(!/login|app-admin|register/.test(sitemap), 'Sitemap contains a noindex route')
check(existsSync(join(root, '404.html')), 'Missing 404.html')
check(/noindex, nofollow/.test(readFileSync(join(root, '404.html'), 'utf8')), '404 must be noindex')

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

const assets = walk(join(root, 'assets'))
const budgets = {
  // Raised from 75 KiB for the tzdata zone table that resolves a visitor's country from
  // their time zone on the registration form: 418 zone/country pairs, 2.8 KiB compressed.
  '.js': 80 * 1024,
  '.css': 24 * 1024,
  '.woff': 0,
  '.woff2': 0,
  '.png': 40 * 1024,
  '.jpg': 40 * 1024,
  '.jpeg': 40 * 1024,
  '.webp': 40 * 1024,
}
const totals = new Map()
for (const asset of assets) {
  const extension = extname(asset)
  const compressed = brotliCompressSync(readFileSync(asset)).byteLength
  totals.set(extension, (totals.get(extension) ?? 0) + compressed)
  check(statSync(asset).size <= 300 * 1024, `${asset}: individual asset exceeds 300 KiB`)
}
for (const [extension, budget] of Object.entries(budgets)) {
  check((totals.get(extension) ?? 0) <= budget, `${extension} compressed total exceeds ${budget} bytes`)
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'))
  process.exit(1)
}

console.log(
  `Verified ${routes.length * locales.length} indexable documents, real 404 artifacts, metadata, CTA/privacy boundaries, and compressed asset budgets.`,
)
