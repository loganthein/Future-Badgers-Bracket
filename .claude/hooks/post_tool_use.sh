#!/bin/bash
# Post-tool-use hook: auto-commit and push after any file write/edit.
# Claude Code passes hook context via stdin — consume it to avoid blocking.
read -r -d '' _ < /dev/stdin 2>/dev/null || true

# Only act if there are uncommitted changes
if [[ -n $(git -C "$(git rev-parse --show-toplevel 2>/dev/null)" status --porcelain 2>/dev/null) ]]; then
  REPO_ROOT=$(git rev-parse --show-toplevel)
  git -C "$REPO_ROOT" add .
  git -C "$REPO_ROOT" commit -m "Auto-update"
  git -C "$REPO_ROOT" push
fi
