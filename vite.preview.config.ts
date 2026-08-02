// Secondary dev-server config for Claude Code preview sessions only.
// Runs on 5174 alongside the normal 5173 server; the API's CORS allowlist
// only knows 5173, so rewrite the proxied Origin header to match.
import { defineConfig, mergeConfig } from 'vite'
import baseConfig from './vite.config'

// vite.config.ts exports the callback form, which mergeConfig cannot merge
// directly ("Cannot merge config in form of callback"), so resolve it first.
export default defineConfig(async (env) => {
  const resolved = typeof baseConfig === 'function' ? await baseConfig(env) : baseConfig
  return mergeConfig(resolved, {
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          headers: { Origin: 'http://localhost:5173' },
        },
      },
    },
  })
})
