#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${API_URL:-http://localhost:8080}"
GENERATED="$ROOT/src/api/generated/types.ts"
TEMP="$(mktemp)"

cleanup() {
  rm -f "$TEMP"
}
trap cleanup EXIT

npx openapi-typescript "${API_URL}/v3/api-docs" -o "$TEMP"

if ! diff -u "$GENERATED" "$TEMP"; then
  echo "OpenAPI contract drift: regenerate with npm run generate:api" >&2
  exit 1
fi

echo "OpenAPI types match generated client."
