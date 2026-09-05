#!/usr/bin/env bash
# Brand guard: fails on any surviving "ibiza" (case-insensitive) outside the allowlist below.
#
# The working title was Ibiza; the product is Leaveo. The rename landed as one branch, so the
# realistic way for the old name to come back is one file at a time -- a copied snippet, a stale
# doc paragraph, a new test fixture. This makes that fail in CI instead of shipping.
set -euo pipefail

cd "$(dirname "$0")/.."

# --untracked so a brand-new file is scanned too, not only what is already committed;
# --no-recurse-submodules because git refuses to combine the two, and a developer may
# have submodule.recurse set globally even though neither repo has a submodule.

# This file is excluded from its own scan: it has to spell the allowlisted names out to match
# them, and it explains itself in prose. It is the definition of the allowlist, not a hit.
EXCLUDES=(':(exclude)CHANGELOG*' ':(exclude)scripts/verify-brand.sh')

# Occurrences that are allowed to survive. Each is stripped from the line before the check;
# anything still matching afterwards fails.
#
#   ibiza-api / ibiza-web  Repository and directory names. TEMPORARY -- delete these two
#                          alternatives once the GitHub repos and local directories are renamed.
#   IBIZA_*                The pre-rename environment variables that vite.config.ts refuses to
#                          build on, so it can name them back to the operator. Permanent while
#                          that guard lives: a guard that cannot say what to rename is useless.
#   Ibiza-handoff.md       Filename of a BMad test-design record written under the working title.
#                          Records are never rewritten, so neither is a link to one.
ALLOWED='
  s/\bibiza-(api|web)\b//gi;
  s/\bIBIZA_[A-Z0-9_]*//g;
  s/\bIbiza-handoff\.md\b//gi;
'

hits="$(git grep -InI --untracked --no-recurse-submodules -i ibiza -- . "${EXCLUDES[@]}" | perl -pe "$ALLOWED" | grep -i ibiza || true)"

if [ -n "$hits" ]; then
  {
    echo "Brand guard failed: the working title survives outside the allowlist."
    echo
    echo "$hits"
    echo
    echo "The product is Leaveo. Rename the occurrence -- or, if it is genuinely a record, a"
    echo "path, or a legacy name an operator still needs to see, add it to the allowlist in"
    echo "scripts/verify-brand.sh with the reason."
  } >&2
  exit 1
fi

echo "brand clean"
