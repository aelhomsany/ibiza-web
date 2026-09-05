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

# src/api/generated/types.ts is the generated output followed by a hand-maintained
# block of schema aliases (see the marker below). Comparing the whole file against
# fresh generator output would always differ by that block, so compare only the
# generated prefix — otherwise this check can never pass and stops being a contract.
MARKER='// Leaveo keeps these schema aliases for feature code ergonomics'
GENERATED_PREFIX="$(mktemp)"
trap 'rm -f "$TEMP" "$GENERATED_PREFIX"' EXIT

if grep -qF "$MARKER" "$GENERATED"; then
  awk -v marker="$MARKER" 'index($0, marker) { exit } { print }' "$GENERATED" > "$GENERATED_PREFIX"
else
  cp "$GENERATED" "$GENERATED_PREFIX"
fi

# The generator emits no trailing blank line; the checked-in file has one before the
# alias block. Strip trailing blanks from both sides before comparing.
strip_trailing_blank_lines() {
  awk 'BEGIN { blanks = 0 }
       /^[[:space:]]*$/ { blanks++; next }
       { for (i = 0; i < blanks; i++) print ""; blanks = 0; print }' "$1"
}

if ! diff -u <(strip_trailing_blank_lines "$GENERATED_PREFIX") <(strip_trailing_blank_lines "$TEMP"); then
  echo "OpenAPI contract drift: regenerate with npm run generate:api" >&2
  echo "(keep the hand-maintained alias block at the end of the file)" >&2
  exit 1
fi

echo "OpenAPI types match generated client."
