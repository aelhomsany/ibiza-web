// Secondary dev-server config for Claude Code preview sessions only.
// Runs on 5174 alongside the normal 5173 server; the API's CORS allowlist
// only knows 5173, so rewrite the proxied Origin header to match.
import { defineConfig, mergeConfig } from 'vite'
import baseConfig from './vite.config'

export default mergeConfig(
  baseConfig,
  defineConfig({
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
  }),
)
