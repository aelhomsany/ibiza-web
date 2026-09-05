#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="${LEAVEO_API_DIR:-$(cd "$ROOT/../ibiza-api" && pwd)}"
API_PORT="${API_PORT:-8080}"
WEB_PORT="${WEB_PORT:-5173}"

if [[ ! -f "$API_DIR/pom.xml" ]]; then
  echo "ibiza-api not found at $API_DIR (set LEAVEO_API_DIR)" >&2
  exit 1
fi

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# JWT_SECRET / PLATFORM_JWT_SECRET are intentionally not exported here: the API is
# launched with the dev profile below, and application-dev.yml supplies the local
# defaults. Hardcoding them here previously let this script drift out of sync with
# the values the boot-time guard checks against.
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-http://localhost:${WEB_PORT}}"
export PUBLIC_CORS_ALLOWED_ORIGINS="${PUBLIC_CORS_ALLOWED_ORIGINS:-http://localhost:${WEB_PORT}}"
export PLATFORM_CORS_ALLOWED_ORIGINS="${PLATFORM_CORS_ALLOWED_ORIGINS:-http://localhost:${WEB_PORT}}"
# Credentials come from ibiza-api/.env when it exists, so this script works on a developer
# machine whose MySQL actually has a password. Only KEY=VALUE lines are read: the file also
# contains prose, so `source`-ing it fails. Anything already exported wins.
#
# DB_NAME is deliberately excluded — that key points at the developer's own dev schema, and
# importing it would silently drag E2E back onto the database this script exists to avoid.
if [[ -f "$API_DIR/.env" ]]; then
  while IFS='=' read -r key value; do
    [[ -n "${!key:-}" ]] || export "$key=$value"
  done < <(grep -E '^DB_(HOST|PORT|USER|PASSWORD)=' "$API_DIR/.env" || true)
fi

export DB_HOST="${DB_HOST:-localhost}"
export DB_PORT="${DB_PORT:-3306}"
# Deliberately NOT the developer's `leaveo` schema. That database was migrated from uncommitted
# working-tree migrations (V30 applied 2026-08-01, first committed 2026-08-02), so Flyway
# validation fails against it and the API cannot start — which surfaced only as a health-check
# timeout and made every @api spec silently unrunnable. E2E gets its own schema, created on
# demand by `createDatabaseIfNotExist=true` and only ever migrated from committed files. Drop it
# if it ever drifts; nothing in it is precious, the demo seeder repopulates it.
export DB_NAME="${DB_NAME:-leaveo_e2e}"
export DB_USER="${DB_USER:-root}"
export DB_PASSWORD="${DB_PASSWORD:-}"
# Story 12.4: the paid registration surfaces are behind their own feature control, independent of
# Free. Without this the API refuses every paid Checkout start with 503 and any paid-path E2E is
# untestable — which is exactly why the Story 12.4 specs previously gated themselves off and never
# ran. Free registration keeps its own control, so enabling one does not enable the other — and
# both are set here, because a runner that leaves a control off is a runner whose @api suites
# cannot pass, which is the defect the Epic 12 retrospective raised.
export PAID_REGISTRATION_ENABLED="${PAID_REGISTRATION_ENABLED:-true}"
export PUBLIC_REGISTRATION_ENABLED="${PUBLIC_REGISTRATION_ENABLED:-true}"
export FREE_PROVISIONING_ENABLED="${FREE_PROVISIONING_ENABLED:-true}"

# The webhook signing secret is shared with the tests on purpose. A Stripe signature is
# HMAC-SHA256 over "{unixSeconds}.{rawBody}", so knowing the secret is all a runner needs to mint
# a genuinely valid one — tests/support/helpers/stripe-webhook.ts does exactly what
# StripeWebhookTestSupport.signPayload does on the API side. Signature verification itself stays
# real: the API hands these to com.stripe.net.Webhook and rejects anything altered after signing.
# This is what makes the paid P0 journeys runnable; they were previously stubbed end to end and
# justified with the claim that no runner could produce these states.
export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_e2e_local_secret}"

# The one seam a runner genuinely cannot cross is outbound HTTP to Stripe — creating a hosted
# Checkout Session is a network call to a third party. SimulatedStripeGateway answers only those
# outbound calls; it still verifies webhook signatures with the real library, and it refuses to
# start outside the dev/test/demo profiles. Prices must be non-blank or StripePlanPriceMapper
# rejects every paid checkout before the gateway is ever reached.
export STRIPE_SIMULATED_PROVIDER="${STRIPE_SIMULATED_PROVIDER:-true}"
export STRIPE_PRICE_STARTER="${STRIPE_PRICE_STARTER:-price_e2e_starter}"
export STRIPE_PRICE_GROWTH="${STRIPE_PRICE_GROWTH:-price_e2e_growth}"

# The raw verification token is never persisted — only its SHA-256 — so the only way to follow a
# real single-use link is to read the mail. The dev sink exposes what LoggingEmailService already
# captures in memory, and like the simulator it refuses to exist outside local profiles.
export DEV_MAIL_SINK_ENABLED="${DEV_MAIL_SINK_ENABLED:-true}"

# Registration links, Checkout return URLs and the customer handoff are all built server-side from
# these. Left at their defaults they point at 5173, so a run on any other port lands the customer
# on a server that is not under test.
export PUBLIC_WEB_BASE_URL="${PUBLIC_WEB_BASE_URL:-http://localhost:${WEB_PORT}}"
export LEAVEO_WEB_BASE_URL="${LEAVEO_WEB_BASE_URL:-http://localhost:${WEB_PORT}}"

# Reset the curated demo tenants before the suite runs. Most @api specs read seeded demo data
# and several MUTATE it — approval-decision approves and declines the seeded pending requests,
# team-member-plan-limit fills an Organization to its seat cap — so a second run against the same
# schema started from whatever the previous run left behind. That is why the same command produced
# a different set of failures on a reused schema than on a fresh one, and it is why
# demo-data-curated.spec.ts documents its precondition as "against a freshly reset curated demo
# DB": the suite was designed for this reset and nothing ever turned it on.
#
# DemoDataResetService is narrowly scoped and refuses to run outside dev/test: it deletes and
# re-seeds only the three Organizations it owns plus 'E2E Nile %', so Organizations created by
# other specs are left alone. DemoDataResetRunner is HIGHEST_PRECEDENCE, so the reset completes
# before the additive DemoDataStartupSeeder runs.
export LEAVEO_DEMO_RESET="${LEAVEO_DEMO_RESET:-true}"

cd "$API_DIR"
./mvnw -q spring-boot:run -Dspring-boot.run.arguments="--server.port=${API_PORT}" \
  -Dspring-boot.run.jvmArguments="-Dspring.profiles.active=dev" &
API_PID=$!

"$ROOT/scripts/wait-for-http.sh" "http://localhost:${API_PORT}/actuator/health" '"status":"UP"' 180

cd "$ROOT"

# Playwright runs with `reuseExistingServer` outside CI, so anything already listening on
# WEB_PORT is adopted silently — including an unrelated project's dev server. When that happens
# every selector misses and the whole suite reports "element(s) not found", which reads like a
# broken application rather than a wrong server. Fail with the real reason instead.
if existing_page=$(curl -fsS --max-time 5 "http://localhost:${WEB_PORT}/" 2>/dev/null); then
  if ! grep -qi 'leaveo' <<<"$existing_page"; then
    served_title=$(grep -oiE '<title>[^<]*</title>' <<<"$existing_page" | head -1)
    echo "Port ${WEB_PORT} is already serving something that is not ibiza-web ${served_title:+(${served_title})}." >&2
    echo "Playwright would reuse it and every test would fail on missing selectors." >&2
    echo "Stop that server, or re-run with a free port: WEB_PORT=5174 $0 $*" >&2
    exit 1
  fi
fi

export E2E_API_AVAILABLE=true
export E2E_PAID_REGISTRATION=true
# This is the maintained regression command, so a contracted P0 suite that selects and then skips
# everything is a failure here rather than a quiet pass. See tests/support/contracted-execution-reporter.ts.
export E2E_REQUIRE_CONTRACTED="${E2E_REQUIRE_CONTRACTED:-true}"
export API_URL="http://localhost:${API_PORT}"
export BASE_URL="http://localhost:${WEB_PORT}"
npm run test:e2e:ci -- "$@"
