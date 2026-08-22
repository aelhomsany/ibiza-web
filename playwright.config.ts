import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '.env') })

const isPublicArtifact = process.env.E2E_PUBLIC_ARTIFACT === 'true'
const baseURL = isPublicArtifact
  ? process.env.PUBLIC_BASE_URL ?? 'http://127.0.0.1:4174'
  : process.env.BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    // Self-disabling unless E2E_REQUIRE_CONTRACTED is set, which the canonical API runner does.
    // Without it a run in which every contracted P0 suite skipped still reports success.
    //
    // Also listed explicitly in the `test:e2e:ci` script, and that is the copy that counts: a CLI
    // `--reporter=` REPLACES this array rather than adding to it, so the config entry alone left
    // the guard silent in exactly the command it was written for.
    ['./tests/support/contracted-execution-reporter.ts'],
    [process.env.CI ? 'line' : 'list'],
  ],
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure-and-retries',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  timeout: 60_000,
  expect: { timeout: 10_000 },
  projects: isPublicArtifact
    ? [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      ]
    : [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: isPublicArtifact
      ? 'npm run preview:public'
      : process.env.CI
        ? 'npm run preview'
        : 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
