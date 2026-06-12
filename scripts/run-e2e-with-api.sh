#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="${IBIZA_API_DIR:-$(cd "$ROOT/../ibiza-api" && pwd)}"
API_PORT="${API_PORT:-8080}"
WEB_PORT="${WEB_PORT:-5173}"

if [[ ! -f "$API_DIR/pom.xml" ]]; then
  echo "ibiza-api not found at $API_DIR (set IBIZA_API_DIR)" >&2
  exit 1
fi

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

export JWT_SECRET="${JWT_SECRET:-dev-only-jwt-secret-change-before-pilot-min-32-chars}"
export DB_HOST="${DB_HOST:-localhost}"
export DB_PORT="${DB_PORT:-3306}"
export DB_NAME="${DB_NAME:-ibiza}"
export DB_USER="${DB_USER:-root}"
export DB_PASSWORD="${DB_PASSWORD:-}"

(
  cd "$API_DIR"
  ./mvnw -q spring-boot:run -Dspring-boot.run.arguments="--server.port=${API_PORT}" \
    -Dspring-boot.run.jvmArguments="-Dspring.profiles.active=dev" &
)
API_PID=$!

"$ROOT/scripts/wait-for-http.sh" "http://localhost:${API_PORT}/actuator/health" '"status":"UP"' 180

cd "$ROOT"
export E2E_API_AVAILABLE=true
export API_URL="http://localhost:${API_PORT}"
export BASE_URL="http://localhost:${WEB_PORT}"
npm run test:e2e
