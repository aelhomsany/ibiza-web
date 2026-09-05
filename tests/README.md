# Leaveo E2E Tests (Playwright)

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

4. For API-backed tests, start `ibiza-api` and set in `.env`:

   ```
   E2E_API_AVAILABLE=true
   ```

## Running Tests

| Command | Purpose |
|---------|---------|
| `npm run test:e2e:api` | All 48 Playwright tests; starts `ibiza-api` from `../ibiza-api` |
| `npm run test:e2e:smoke:api` | Exact seven-test executable smoke set; starts the API |
| `npm run test:e2e:regression:api` | Full 48-test regression; starts the API |
| `npm run test:e2e:ui-only` | Five browser-only tests; no API required |
| `E2E_API_AVAILABLE=true npm run test:e2e:smoke` | Smoke against an API already running on `:8080` |
| `E2E_API_AVAILABLE=true npm run test:e2e:regression` | Regression against an API already running on `:8080` |
| `npm run verify:e2e-tags` | Validate exact manifest membership and effective tag invariants |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run test:e2e:headed` | Headed browser |
| `npm run test:e2e:debug` | Debug mode |
| `npm run test:e2e:report` | Open HTML report after a run |
| `npm run verify:openapi` | Diff `src/api/generated/types.ts` against live OpenAPI |

Unit/component tests remain separate: `npm run test:ci` (Vitest run-once mode).

### Tag taxonomy

Tags are independent execution metadata. Every discovered Playwright test inherits
`@regression` and exactly one dependency tag: `@api` or `@ui-only`. The approved executable
smoke set additionally inherits `@smoke`; smoke always implies `@regression @api`. Optional
`@a11y`, `@keyboard`, and well-formed `@story-{epic}-{story}` tags may supplement those required
tags.

The executable smoke set is exactly seven tests from these describes:

- `auth-login.spec.ts` — `Authentication API` and `Authentication UI` (2)
- `settings-hr.spec.ts` — `HR Settings page` (3)
- `approval-inbox.spec.ts` — `Approval inbox — Story 3.6` (1)
- `public-entry-boundaries.spec.ts` — `Platform Admin boundary — Story 12.1` (1)

`tests/e2e/tag-manifest.json` is the reviewable exact-membership source and
`tests/support/tag-integrity-reporter.ts` validates Playwright-discovered effective tags. Tags
never replace concrete `file::describe::test title` identities in validation or trace artifacts.

## Architecture

```
tests/
├── e2e/                    # Playwright spec files
│   ├── tag-manifest.json   # Exact test titles and effective tags
│   └── *.spec.ts           # Sparse browser journeys
└── support/
    ├── tags.ts             # Canonical tag constants
    ├── tag-integrity-reporter.ts
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
- **Selectors:** Prefer `data-testid` per TEA handoff (`sign-in-email`, `nav-calendar`, etc.).
- **Network:** Use Playwright `request` fixture for API calls; UI flows go through `page`.
- **Tags:** Apply canonical tags at `test.describe` level. Every maintained test is
  `@regression` plus exactly one of `@api`/`@ui-only`; update `tag-manifest.json` with any change.

## Best Practices

- Import `test` and `expect` from `tests/support/fixtures`, not `@playwright/test` directly (except in fixture definitions).
- No hard-coded sleeps — use Playwright auto-waiting and `expect` retries.
- Keep tests isolated; factories clean up after each test.
- Map future UI tests to `data-testid` values in `_bmad-output/test-artifacts/test-design/Ibiza-handoff.md`.

## CI Integration

GitHub Actions runs two E2E jobs after build:

1. **`e2e`** — validates the tag manifest, then runs only `@ui-only` with `E2E_API_AVAILABLE=false`
2. **`e2e-with-api`** — validates the tag manifest, starts MySQL + API, runs `verify:openapi`, then executes the complete `@regression` suite with `E2E_API_AVAILABLE=true`

Both use `vite preview` in CI (see `playwright.config.ts` `webServer` command).

Artifacts: `test-results/` (JUnit + traces) and `playwright-report/` on failure.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Browser not installed | `npx playwright install chromium` |
| Port 5173 in use | Stop other Vite dev servers or change `BASE_URL` |
| API-backed test skipped | Set `E2E_API_AVAILABLE=true` and run `ibiza-api` on `:8080`, or use an `:api` wrapper |
| Integrity check fails | Reconcile the spec tags and exact titles in `tests/e2e/tag-manifest.json` |

### Story 6.4 plan-limit regression journey

`tests/e2e/team-member-plan-limit.spec.ts` is an API-backed full-stack regression journey. It creates a unique Free
organization through the platform API, signs a short-lived HR token with the same `JWT_SECRET` used
by the E2E API process, seeds the org to five users (the FREE(5) cap), then verifies that adding
a sixth makes Settings show the plan-limit
warning toast and leaves the Add Member modal open.

## Knowledge Base References

- Playwright config guardrails (TEA): `playwright-config.md`
- Fixture architecture: `fixture-architecture.md`
- Data factories: `data-factories.md`
- Auth session patterns: `auth-session.md`

Optional enhancement: install [`@seontechnologies/playwright-utils`](https://www.npmjs.com/package/@seontechnologies/playwright-utils) when TEA utils are needed (`tea_use_playwright_utils: true` in TEA config).
