#!/usr/bin/env bash
set -euo pipefail

# Runs the full customer acquisition journey locally: marketing site -> plans -> registration ->
# checkout -> provisioning -> the customer app.
#
# This exists because none of that is reachable from a plain `npm run dev` + an API started from
# the IDE. Two reasons, both silent:
#
#   1. ibiza-api does not read ibiza-api/.env. PUBLIC_REGISTRATION_ENABLED, PAID_REGISTRATION_ENABLED
#      and FREE_PROVISIONING_ENABLED all default to false in application.yml, so an API launched
#      without these exported answers GET /api/v1/public/plans with "registrationEnabled": false and
#      refuses every registration and checkout — while /actuator/health stays UP and the customer
#      app works normally. Nothing on screen says the signup flow is switched off.
#   2. The public site is a separate artifact on a separate origin. On the customer origin '/' is
#      the app (see the entryBoundaryRouter comment in vite.config.ts), so the marketing home has
#      nowhere to live there. It gets its own dev server here, which is also the topology the
#      handoff is written for: SelfServiceProvisioningService returns an absolute customer URL
#      precisely because registration runs on the public origin.
#
# Not run-e2e-with-api.sh: that one deliberately targets the throwaway ibiza_e2e schema and resets
# the demo tenants. This one runs against the developer's own database and touches no data.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="${IBIZA_API_DIR:-$(cd "$ROOT/../ibiza-api" && pwd)}"
API_PORT="${API_PORT:-8080}"
WEB_PORT="${WEB_PORT:-5173}"
PUBLIC_PORT="${PUBLIC_PORT:-4174}"

if [[ ! -f "$API_DIR/pom.xml" ]]; then
  echo "ibiza-api not found at $API_DIR (set IBIZA_API_DIR)" >&2
  exit 1
fi

# An API already on the port is the trap this script exists to explain, not something to work
# around silently: if it was started without the flags below, every plan CTA dead-ends and the
# reason is invisible. Say so, rather than starting a second one that cannot bind.
if existing_plans=$(curl -fsS --max-time 5 "http://localhost:${API_PORT}/api/v1/public/plans" 2>/dev/null); then
  if grep -q '"registrationEnabled":false' <<<"$existing_plans"; then
    echo "An API is already running on :${API_PORT} with self-service registration DISABLED." >&2
    echo "That is what makes /register and every plan CTA dead-end. Stop it and re-run this script," >&2
    echo "which starts the API with the registration and billing controls turned on." >&2
    exit 1
  fi
  echo "Reusing the API already running on :${API_PORT} (registration is enabled there)."
  REUSE_API=true
else
  REUSE_API=false
fi

PIDS=()
cleanup() {
  for pid in "${PIDS[@]:-}"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT INT TERM

# Database and mail credentials come from the developer's own ibiza-api/.env — including DB_NAME,
# unlike the E2E runner. The point of this script is to sign up into the database you already
# work in. Only KEY=VALUE lines are read: the file also contains prose, so it cannot be sourced.
if [[ -f "$API_DIR/.env" ]]; then
  while IFS='=' read -r key value; do
    [[ -n "${!key:-}" ]] || export "$key=$value"
  done < <(grep -E '^[A-Z][A-Z0-9_]*=' "$API_DIR/.env" || true)
fi

# Both origins must be allowed: registration posts from the public one, the app from the other.
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-http://localhost:${WEB_PORT}}"
export PUBLIC_CORS_ALLOWED_ORIGINS="http://localhost:${PUBLIC_PORT},http://localhost:${WEB_PORT}"
export PLATFORM_CORS_ALLOWED_ORIGINS="${PLATFORM_CORS_ALLOWED_ORIGINS:-http://localhost:${WEB_PORT}}"

# The three controls that gate the journey. Free and paid are independent: leaving either off
# turns its half of the pricing table into a dead end.
export PUBLIC_REGISTRATION_ENABLED="${PUBLIC_REGISTRATION_ENABLED:-true}"
export FREE_PROVISIONING_ENABLED="${FREE_PROVISIONING_ENABLED:-true}"
export PAID_REGISTRATION_ENABLED="${PAID_REGISTRATION_ENABLED:-true}"

# Creating a hosted Checkout Session is an outbound call to Stripe, so a local run needs either
# real test keys or the simulator. The simulator is the default *even when ibiza-api/.env supplies
# real sk_test_ keys*, because real Checkout also needs Stripe to reach a webhook endpoint on this
# machine (`stripe listen` or a tunnel) — without that the journey stops dead at Confirming
# Payment. SimulatedStripeGateway answers only the outbound calls, still verifies webhook
# signatures with the real Stripe library, and refuses to start outside dev/test/demo.
#
# To drive real Stripe test mode instead: STRIPE_SIMULATED_PROVIDER=false npm run dev:journey,
# with `stripe listen --forward-to localhost:8080/api/v1/billing/stripe/webhook` running and its
# whsec_ exported. Price ids must be non-blank either way or StripePlanPriceMapper rejects every
# paid checkout before the gateway is reached; .env's real price ids are used when present.
export STRIPE_SIMULATED_PROVIDER="${STRIPE_SIMULATED_PROVIDER:-true}"
export STRIPE_PRICE_STARTER="${STRIPE_PRICE_STARTER:-price_dev_starter}"
export STRIPE_PRICE_GROWTH="${STRIPE_PRICE_GROWTH:-price_dev_growth}"
export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_dev_local_secret}"

# ibiza-api/.env sets EMAIL_PROVIDER=resend with a live RESEND_API_KEY, so inheriting it would
# send every verification and welcome mail of every local sign-up through the real provider — to
# whatever address was typed into the form. The journey is driven from the in-memory sink instead,
# which is also the only provider the sink can read. Export EMAIL_PROVIDER yourself to override.
export EMAIL_PROVIDER="${EMAIL_PROVIDER_OVERRIDE:-logging}"

# The raw verification token is never persisted — only its SHA-256 — so the only way to follow a
# real single-use verification link locally is to read the mail the sink captured:
#   curl -s 'localhost:8080/api/v1/dev/mail?recipient=you@example.test'
export DEV_MAIL_SINK_ENABLED="${DEV_MAIL_SINK_ENABLED:-true}"

# Every link the server builds is absolute, and the two halves of the journey live on different
# origins: verification and checkout-return land on the public site, the post-provisioning handoff
# lands on the app. Getting these wrong sends a real customer to a 404 holding a live sign-in code.
export PUBLIC_WEB_BASE_URL="http://localhost:${PUBLIC_PORT}"
export IBIZA_WEB_BASE_URL="http://localhost:${WEB_PORT}"
# The one RegistrationEmailSender actually reads for the verification link
# (ibiza.public-experience.public-base-url). PUBLIC_WEB_BASE_URL above only feeds the Stripe
# return URLs, so setting that alone still mailed people a link to the *app* origin, which serves
# no /register/verify route and bounces them to /login holding a live single-use token.
export IBIZA_PUBLIC_EXPERIENCE_PUBLIC_BASE_URL="http://localhost:${PUBLIC_PORT}"

API_PID=""
if [[ "$REUSE_API" == "false" ]]; then
  echo "Starting ibiza-api on :${API_PORT} (registration + paid checkout enabled)…"
  (cd "$API_DIR" && ./mvnw -q spring-boot:run \
    -Dspring-boot.run.arguments="--server.port=${API_PORT}" \
    -Dspring-boot.run.jvmArguments="-Dspring.profiles.active=dev") &
  API_PID=$!
  PIDS+=($API_PID)
  "$ROOT/scripts/wait-for-http.sh" "http://localhost:${API_PORT}/actuator/health" '"status":"UP"' 180
fi

echo "Starting the public site on :${PUBLIC_PORT} (marketing home, pricing, registration)…"
# Split origins, so the marketing site's sign-in links have to be absolute against the app.
# Resolved here rather than inline below: that command overrides WEB_PORT for the public server,
# and a shell applies command-prefix assignments left to right, so an inline "${WEB_PORT}" would
# expand to the public port and point every "Customer Log In" back at the marketing site's 404.
APP_ORIGIN="http://localhost:${WEB_PORT}"
(cd "$ROOT" && IBIZA_ARTIFACT=public WEB_PORT="$PUBLIC_PORT" \
  VITE_PUBLIC_APP_BASE_URL="$APP_ORIGIN" npx vite) &
PIDS+=($!)

echo "Starting the customer app on :${WEB_PORT} (sign-in, dashboard, billing)…"
(cd "$ROOT" && WEB_PORT="$WEB_PORT" npx vite) &
PIDS+=($!)

"$ROOT/scripts/wait-for-http.sh" "http://localhost:${PUBLIC_PORT}/pricing" 'html' 60
"$ROOT/scripts/wait-for-http.sh" "http://localhost:${WEB_PORT}/login" 'html' 60

cat <<EOF

  The customer journey is up.

    Marketing home   http://localhost:${PUBLIC_PORT}/
    Plans            http://localhost:${PUBLIC_PORT}/pricing
    Sign up          http://localhost:${PUBLIC_PORT}/register
    Verification mail  curl -s 'http://localhost:${API_PORT}/api/v1/dev/mail?recipient=<the address you signed up with>'
    The app          http://localhost:${WEB_PORT}/

  Paid plans run against the Stripe simulator, so Checkout completes without a card.
  Mail is captured in memory, not sent — read it with the command above.

  Do NOT run the Playwright suite against this stack. Its specs drive /register on BASE_URL
  (:${WEB_PORT}) while this API returns to the public origin (:${PUBLIC_PORT}), and the
  registration session cookie cannot cross origins — the paid specs fail on a return page that
  cannot read its own registration. Use scripts/run-e2e-with-api.sh, which keeps one origin.

  Ctrl-C stops everything this script started.

EOF

# Deliberately not a bare `wait`. Under `set -e` that made one child's death fatal to the script,
# which fired the EXIT trap and killed the *other* children — so restarting the API from an IDE
# (SIGKILL, exit 137) silently took the marketing site and the app down with it, and the only
# visible symptom was "the home page won't load". Supervise instead: report what died, keep
# serving what is still alive, and let Ctrl-C do the cleanup.
set +e
while true; do
  if [[ -n "$API_PID" ]] && ! kill -0 "$API_PID" 2>/dev/null; then
    cat <<WARN

  The API on :${API_PORT} exited — restarted from your IDE?

  The marketing site (:${PUBLIC_PORT}) and the app (:${WEB_PORT}) are STILL RUNNING.
  But an API started outside this script has self-service registration OFF and only
  allows origin :${WEB_PORT}, so /pricing CTAs dead-end and :${PUBLIC_PORT} gets 403s.
  Stop that API and re-run this script, or export the same variables in your run config.

WARN
    API_PID=""
  fi
  sleep 5
done
