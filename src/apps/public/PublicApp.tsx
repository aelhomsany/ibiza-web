import { PublicPage } from '../../features/public-site/PublicPage'
import { resolvePublicRoute } from '../../features/public-site/publicRoutes'

/**
 * PublicApp is authentication-neutral. Production documents are statically
 * rendered from the same component tree; only the consent island hydrates.
 */
export function PublicApp({ pathname }: { pathname: string }) {
  const { locale, route } = resolvePublicRoute(pathname)
  return <PublicPage locale={locale} route={route} />
}
