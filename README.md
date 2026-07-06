# ibiza-web

React SPA for Ibiza leave management.

## Stack

- React 19, TypeScript, Vite 8
- React Router 7, TanStack Query 5
- Vitest + Testing Library, Playwright E2E

## Local development

### Prerequisites

- Node.js 20.19+ or 22.12+
- Running `ibiza-api` (see sibling repo)

### 1. Configure environment

```bash
cp .env.example .env
```

For **session cookies** (refresh token) in local dev, leave `VITE_API_URL` empty or unset so API calls use relative `/api/*` paths through the Vite proxy on port 5173. Setting `VITE_API_URL=http://localhost:8080` bypasses the proxy and breaks cookie-based refresh.

### 2. Install and run

```bash
npm install
npm run dev
```

SPA runs on **http://localhost:5173**. Requests to `/api/*` are proxied to the API on port 8080.

## Full-stack local dev (with ibiza-api)

1. In sibling repo `../ibiza-api`: ensure local MySQL is running, export `.env`, then `./mvnw spring-boot:run`.
2. In this repo: `cp .env.example .env`, then `npm run dev`.
3. Open **http://localhost:5173** — unauthenticated users land on `/login`.
4. Pilot credentials (password `PilotDev123!` for all):

| Email | Role | Home after login |
|-------|------|------------------|
| `sarah@company.com` | Employee | `/` |
| `alex@company.com` | Manager | `/` |
| `jordan@company.com` | HR Admin | `/` |
| `riley@ibiza.app` | Platform Admin | `/platform/organizations` |

See `../ibiza-api/README.md` for backend setup.

## Authentication flow

1. **Login** — `/login` posts email/password to `POST /api/v1/auth/login`; access token stored in memory; refresh token in httpOnly cookie (`ibiza_refresh`).
2. **Session restore** — on app load, `AuthProvider` calls `POST /api/v1/auth/refresh` then `GET /api/v1/auth/me`.
3. **Protected routes** — org and admin shells require authentication; unauthenticated visitors redirect to `/login`.
4. **Role guards** — `RoleGuard` enforces authorization after `ProtectedRoute` authentication:
   - Org shell (`shell="org"`): `EMPLOYEE`, `MANAGER`, `HR_ADMIN` only; `PLATFORM_ADMIN` redirects to `/platform/organizations`
   - Admin shell (`shell="admin"`): `PLATFORM_ADMIN` only; org roles redirect to `/`
   - Route-level guards: `/approvals` → Manager + HR Admin; `/settings` → HR Admin only
5. **Post-login routing** — org roles → `/` (Dashboard); `PLATFORM_ADMIN` → `/platform/organizations`.
6. **Sign out** — sidebar footer button calls `POST /api/v1/auth/logout`, clears client state, returns to `/login`.
7. **Password reset** — `/forgot-password` and `/reset-password?token=...` (API from Story 1.4).

Unauthorized direct URLs redirect to the user's role home (not a separate 403 page in v1).

Role nav rules live in `src/auth/rolePermissions.ts` (single source of truth for sidebar items and route access helpers).

All HTTP calls go through `src/api/client.ts` with `credentials: 'include'`, Bearer auth, `X-Correlation-Id`, and a single 401 refresh retry.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server on :5173 |
| `npm run build` | Production build to `dist/` |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run generate:api` | Regenerate OpenAPI types from running API (`http://localhost:8080/v3/api-docs`) |
| `npm run lint` | ESLint |

### OpenAPI types

Hand-maintained auth types live in `src/api/generated/types.ts`. When the API is running:

```bash
npm run generate:api
```

Commit updated generated files when API contracts change.

### Platform create organization E2E

`tests/e2e/platform-create-organization.spec.ts` and
`tests/e2e/platform-edit-subscription.spec.ts` are opt-in full-stack smokes. Start `ibiza-api` and
`ibiza-web`, then run them with:

```bash
E2E_API_AVAILABLE=true npm run test:e2e -- tests/e2e/platform-create-organization.spec.ts
E2E_API_AVAILABLE=true npm run test:e2e -- tests/e2e/platform-edit-subscription.spec.ts
E2E_API_AVAILABLE=true npm run test:e2e -- tests/e2e/team-member-plan-limit.spec.ts
```

They sign in as the seeded Platform Admin. The create smoke creates a uniquely named organization
and verifies the row appears with plan badge, initial HR contact, and user count. The edit
subscription smoke opens the row action modal, updates the plan, and verifies the plan badge/user
limit update on the Organizations table. The team-member plan-limit smoke creates a Free
organization through the platform API, seeds it to the 3-user limit, then verifies Settings shows
the server warning detail and keeps the Add Member modal open.

## Project layout

Feature-first folders under `src/features/`. Shared UI in `src/components/`. Auth session in `src/auth/`. API client in `src/api/client.ts`.

### Application shells

Two route-based shells share one SPA (both require sign-in). Navigation is filtered by role from `/api/v1/auth/me`:

| Role | Org nav | Admin shell |
|------|---------|-------------|
| Employee | Dashboard, My Leaves, Team Calendar | — |
| Manager | + Approvals | — |
| HR Admin | + Settings | — |
| Platform Admin | — | Organizations only |

| Shell | Routes | Visual |
|-------|--------|--------|
| Organization app | `/`, `/my-leaves`, `/calendar`, `/approvals`, `/settings` | 240px teal sidebar, mist canvas |
| Platform Admin | `/platform`, `/platform/organizations` | Deep teal sidebar, mint CTAs |

Platform Admin sessions are billing-console only: the admin shell has Organizations navigation and
no notification bell, balance cards, leave tables, approvals, calendar, or settings surfaces.

Public routes (no shell): `/login`, `/forgot-password`, `/reset-password`.

Design tokens live in `src/styles/tokens.css` (sourced from planning artifact `DESIGN.md`). Component CSS must use `var(--color-*)` — no hardcoded hex outside `tokens.css`.

### Shared UI primitives (`src/components/ui/`)

Reuse these — never re-implement per feature:

- **`Modal`** — native `<dialog>`; focus trap, Escape, and focus-return come from the browser. All modals go through it (jsdom `showModal` polyfill in `src/test/setup.ts`).
- **`Toast` + `useToast`** — one toast slot per page: 5s auto-dismiss, pauses on hover/focus, dismiss button, `role=status|alert`.
- **`icons.tsx`** — stroke-SVG icon set (currentColor) for all UI chrome; emoji only in content data.
- **`DateField`** (`src/components/DateField.tsx`) — click/Enter/Space open the calendar; native keyboard editing stays enabled.
- Responsive: single **900px breakpoint** — sidebar collapses to a drawer via `ShellTopBar`; pages are `React.lazy` route chunks in `AppRouter.tsx`.

**Manual check:** `npm run dev` → sign in → verify dashboard, browser refresh keeps session, sign out returns to login.
