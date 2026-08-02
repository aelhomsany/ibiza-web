/* eslint-disable react-refresh/only-export-components */
import { renderToStaticMarkup } from 'react-dom/server'
import ar from '../i18n/locales/ar/public.json'
import en from '../i18n/locales/en/public.json'
import { PublicPage } from '../features/public-site/PublicPage'
import {
  PUBLIC_INDEXABLE_ROUTE_PATHS,
  PUBLIC_ROUTE_PATHS,
  PUBLIC_TASK_ROUTE_PATHS,
  type PublicRoutePath,
} from '../features/public-site/publicRoutes'
import type { PublicLocale } from '../features/public-site/PublicEvidence'

export { PUBLIC_INDEXABLE_ROUTE_PATHS, PUBLIC_ROUTE_PATHS, PUBLIC_TASK_ROUTE_PATHS }

type Metadata = {
  title: string
  description: string
}

type Dictionary = typeof en

function metadata(copy: Dictionary, route: PublicRoutePath | '/404'): Metadata {
  switch (route) {
    case '/':
      return { title: copy.home.title, description: copy.home.description }
    case '/product':
      return { title: copy.product.title, description: copy.product.description }
    case '/distributed-teams':
      return {
        title: copy.distributedTeams.title,
        description: copy.distributedTeams.description,
      }
    case '/working-day-transparency':
      return {
        title: copy.workingDays.title,
        description: copy.workingDays.description,
      }
    case '/security':
      return { title: copy.security.title, description: copy.security.description }
    case '/pricing':
      return { title: copy.pricing.title, description: copy.pricing.description }
    case '/contact-sales':
      return {
        title: copy.contactSales.title,
        description: copy.contactSales.description,
      }
    case '/register':
      return { title: copy.registration.title, description: copy.registration.description }
    case '/register/verify':
      return { title: copy.registration.verifyTitle, description: copy.registration.expired }
    case '/register/recovery':
      return { title: copy.registration.recoveryTitle, description: copy.registration.recoveryBody }
    case '/register/checkout-return':
      return {
        title: copy.registration.checkoutReturn.title,
        description: copy.registration.checkoutReturn.waiting,
      }
    case '/privacy':
      return { title: copy.privacy.title, description: copy.privacy.description }
    case '/terms':
      return { title: copy.terms.title, description: copy.terms.description }
    default:
      return { title: copy.notFound.title, description: copy.notFound.description }
  }
}

export function renderPublicRoute(
  locale: PublicLocale,
  route: PublicRoutePath | '/404',
) {
  const copy = (locale === 'ar' ? ar : en) as Dictionary
  return {
    ...metadata(copy, route),
    html: renderToStaticMarkup(<PublicPage locale={locale} route={route} />),
  }
}
