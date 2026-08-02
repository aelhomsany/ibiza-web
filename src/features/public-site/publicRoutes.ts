import type { PublicLocale } from './PublicEvidence'

export const PUBLIC_INDEXABLE_ROUTE_PATHS = [
  '/',
  '/product',
  '/distributed-teams',
  '/working-day-transparency',
  '/security',
  '/pricing',
  '/contact-sales',
  '/privacy',
  '/terms',
] as const

export const PUBLIC_TASK_ROUTE_PATHS = [
  '/register',
  '/register/verify',
  '/register/recovery',
  '/register/checkout-return',
] as const

export const PUBLIC_ROUTE_PATHS = [
  ...PUBLIC_INDEXABLE_ROUTE_PATHS,
  ...PUBLIC_TASK_ROUTE_PATHS,
] as const

export type PublicRoutePath = (typeof PUBLIC_ROUTE_PATHS)[number]

export function isRegisterRouteAvailable(): boolean {
  return true
}

export type ResolvedPublicRoute = {
  locale: PublicLocale
  route: PublicRoutePath | '/404'
}

export function resolvePublicRoute(pathname: string): ResolvedPublicRoute {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const locale: PublicLocale =
    normalized === '/ar' || normalized.startsWith('/ar/') ? 'ar' : 'en'
  const routePath =
    locale === 'ar'
      ? normalized === '/ar'
        ? '/'
        : normalized.slice(3) || '/'
      : normalized
  const route = PUBLIC_ROUTE_PATHS.includes(routePath as PublicRoutePath)
    ? (routePath as PublicRoutePath)
    : '/404'
  return { locale, route }
}
