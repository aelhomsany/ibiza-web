# Ibiza E2E Tests (Playwright)

End-to-end tests for the `ibiza-web` SPA against the local Vite dev server (and optionally `ibiza-api`).

## Setup

1. Use Node **22** (see `.nvmrc`):

   ```bash
   nvm use
   ```

2. Install dependencies and Playwright browsers:

   ```bash
   npm ci
   npx playwright install chromium
   ```

3. Copy environment template:

   ```bash
   cp .env.example .env
   ```

4. For API auth tests, start `ibiza-api` and set in `.env`:

   ```
   E2E_API_AVAILABLE=true
   ```

## Running Tests

| Command | Purpose |
|---------|---------|
| `npm run test:e2e` | Headless E2E (starts Vite dev server automatically) |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run test:e2e:headed` | Headed browser |
| `npm run test:e2e:debug` | Debug mode |
| `npm run test:e2e:report` | Open HTML report after a run |
| `npm run test:e2e:api` | E2E with `ibiza-api` running (starts API from `../ibiza-api`) |
| `npm run verify:openapi` | Diff `src/api/generated/types.ts` against live OpenAPI |

Unit/component tests remain separate: `npm test` (Vitest).

## Architecture

```
tests/
├── e2e/                    # Playwright spec files
│   ├── example.spec.ts     # Smoke + factory demo
│   └── auth-login.spec.ts  # Auth API/UI (UI skipped until Story 1.6)
└── support/
    ├── fixtures/
    │   ├── index.ts        # mergeTests entrypoint — import { test, expect } from here
    │   └── factories/
    │       └── user-factory.ts
    └── helpers/
        ├── api-client.ts   # Typed API requests with X-Correlation-Id
        └── auth.ts         # loginViaApi / loginViaUi helpers
```

### Patterns

- **Fixtures:** Pure helpers wrapped in Playwright fixtures; compose via `mergeTests` in `support/fixtures/index.ts`.
- **Factories:** `@faker-js/faker` with in-memory tracking and `cleanup()` on fixture teardown.
- **Selectors:** Prefer `data-testid` per TEA handoff (`sign-in-email`, `nav-dashboard`, etc.).
- **Network:** Use Playwright `request` fixture for API calls; UI flows go through `page`.

## Best Practices

- Import `test` and `expect` from `tests/support/fixtures`, not `@playwright/test` directly (except in fixture definitions).
- No hard-coded sleeps — use Playwright auto-waiting and `expect` retries.
- Keep tests isolated; factories clean up after each test.
- Map future UI tests to `data-testid` values in `_bmad-output/test-artifacts/test-design/Ibiza-handoff.md`.

## CI Integration

GitHub Actions runs two E2E jobs after build:

1. **`e2e`** — SPA-only (API tests skipped; `E2E_API_AVAILABLE=false`)
2. **`e2e-with-api`** — checks out `ibiza-api`, starts MySQL + API, runs `verify:openapi` and full E2E with `E2E_API_AVAILABLE=true`

Both use `vite preview` in CI (see `playwright.config.ts` `webServer` command).

Artifacts: `test-results/` (JUnit + traces) and `playwright-report/` on failure.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Browser not installed | `npx playwright install chromium` |
| Port 5173 in use | Stop other Vite dev servers or change `BASE_URL` |
| API auth test skipped | Set `E2E_API_AVAILABLE=true` and run `ibiza-api` on `:8080` |
| Login UI test skipped | Expected until Epic 1 Story 1.6 implements login page + test IDs |

## Knowledge Base References

- Playwright config guardrails (TEA): `playwright-config.md`
- Fixture architecture: `fixture-architecture.md`
- Data factories: `data-factories.md`
- Auth session patterns: `auth-session.md`

Optional enhancement: install [`@seontechnologies/playwright-utils`](https://www.npmjs.com/package/@seontechnologies/playwright-utils) when TEA utils are needed (`tea_use_playwright_utils: true` in TEA config).
