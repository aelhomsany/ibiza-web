#!/usr/bin/env bash
set -euo pipefail

URL="${1:?URL required}"
EXPECTED="${2:-}"
TIMEOUT_SECONDS="${3:-120}"
INTERVAL_SECONDS="${4:-2}"

deadline=$((SECONDS + TIMEOUT_SECONDS))

while (( SECONDS < deadline )); do
  if response="$(curl -fsS "$URL" 2>/dev/null || true)"; then
    if [[ -z "$EXPECTED" ]] || grep -q "$EXPECTED" <<<"$response"; then
      exit 0
    fi
  fi
  sleep "$INTERVAL_SECONDS"
done

echo "Timed out waiting for $URL (expected: ${EXPECTED:-any 2xx response})" >&2
exit 1
