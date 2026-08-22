/// <reference types="vitest/config" />
import { defineConfig, type Plugin, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

type Artifact = 'customer' | 'public' | 'public-render' | 'admin'

function entryBoundaryRouter(artifact: Artifact): Plugin {
  return {
    name: 'ibiza-entry-boundary-router',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
    },
    configureServer(server) {
      if (artifact !== 'customer') {
        return
      }

      server.middlewares.use((request, _response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
        const acceptsHtml = request.headers.accept?.includes('text/html') ?? false
        const isAssetOrApi =
          pathname.startsWith('/api/') ||
          pathname.startsWith('/@') ||
          pathname.startsWith('/src/') ||
          pathname.startsWith('/node_modules/') ||
          /\.[a-z0-9]+$/i.test(pathname)

        if (acceptsHtml && !isAssetOrApi) {
          const isArabicPublic = pathname.startsWith('/ar/')
          const publicPath = isArabicPublic ? pathname.slice(3) : pathname
          const isPublicRoute = [
            '/',
            '/product',
            '/distributed-teams',
            '/working-day-transparency',
            '/security',
            '/pricing',
            '/contact-sales',
            '/privacy',
            '/terms',
            '/register',
            '/register/verify',
            '/register/recovery',
          ].includes(publicPath) || publicPath.startsWith('/register/')

          // '/' is the one path two artifacts both claim, and on THIS origin it belongs to
          // the customer app. That is what dist/app/deployment.json declares, what
          // scripts/serve-spa-artifacts.mjs implements ("mirrors the production host rule
          // the artifacts are built for"), and what getHomePath() returns after sign-in.
          // The public site owns '/' on its OWN origin, which scripts/serve-public.mjs
          // serves on port 4174 and where public-entry-boundaries.spec.ts asserts it.
          //
          // Resolving '/' here to the public document made this dev server the only
          // topology in the project where it did not, so every full page load at '/' —
          // including the post-sign-in redirect — rendered marketing copy instead of the
          // app. That is why CI (npm run preview, correct topology) stayed green while the
          // local runner (npm run dev) failed a block of @api specs on missing selectors.
          //
          // Every other public path stays multiplexed: those are unambiguous, and the
          // pricing/contact-sales/registration specs reach them through this server.
          // The Arabic prefix stays public throughout — the customer artifact serves no
          // /ar/* route, so /ar/ is unambiguous in a way that bare '/' is not.
          const claimedByCustomerArtifact = publicPath === '/' && !isArabicPublic

          request.url = pathname.startsWith('/app-admin')
            ? '/admin.html'
            : isPublicRoute && !claimedByCustomerArtifact
              ? '/public.html'
              : '/app.html'
        }
        next()
      })
    },
  }
}

export default defineConfig(() => {
  const artifact = (process.env.IBIZA_ARTIFACT ?? 'customer') as Artifact
  const projectRoot = process.cwd()
  const apiProxyTarget = process.env.API_URL ?? 'http://localhost:8080'
  const webPort = Number(process.env.WEB_PORT ?? 5173)
  const input: Record<string, string> =
    artifact === 'public'
      ? { public: resolve(projectRoot, 'public.html') }
      : artifact === 'admin'
        ? { index: resolve(projectRoot, 'admin.html') }
        : { index: resolve(projectRoot, 'app.html') }
  const build: UserConfig['build'] =
    artifact === 'public-render'
      ? {
          outDir: '.public-ssr',
          emptyOutDir: true,
          ssr: resolve(projectRoot, 'src/entries/public-render.tsx'),
        }
      : {
          outDir:
            artifact === 'public'
              ? 'dist/public'
              : artifact === 'admin'
                ? 'dist/admin'
                : 'dist/app',
          emptyOutDir: true,
          rolldownOptions: {
            input,
          },
        }

  const envPrefix =
    artifact === 'public' || artifact === 'public-render'
      ? ['VITE_API_URL', 'VITE_PUBLIC_']
      : artifact === 'admin'
        ? ['VITE_API_URL', 'VITE_ADMIN_']
        : ['VITE_API_URL', 'VITE_APP_']

  return {
    plugins: [react(), entryBoundaryRouter(artifact)],
    envPrefix,
    build,
    server: {
      port: webPort,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: webPort,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
    },
  }
})
