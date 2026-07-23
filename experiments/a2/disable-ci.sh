#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${EXPECTED_REPOSITORY:?EXPECTED_REPOSITORY is required}"
: "${TARGET_WORKFLOW:?TARGET_WORKFLOW is required}"

if [[ "$GITHUB_REPOSITORY" != "$EXPECTED_REPOSITORY" ]]; then
  printf 'unexpected_repository=%s\n' "$GITHUB_REPOSITORY" >&2
  exit 1
fi

before=$(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/$TARGET_WORKFLOW" --jq '.state')
printf 'target_workflow=%s\n' "$TARGET_WORKFLOW"
printf 'state_before=%s\n' "$before"
test "$before" = "active"

gh api --method PUT "repos/$GITHUB_REPOSITORY/actions/workflows/$TARGET_WORKFLOW/disable"

after=$(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/$TARGET_WORKFLOW" --jq '.state')
printf 'state_after=%s\n' "$after"
test "$after" = "disabled_manually"
