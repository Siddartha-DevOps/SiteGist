#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

# Apply the same model guardrail as cloud-start.sh for terminal sessions.
if [[ -n "${PORTKEY_MODEL:-}" && -z "${PORTKEY_API_KEY:-}" ]]; then
  if [[ "$PORTKEY_MODEL" == @* ]] || [[ "$PORTKEY_MODEL" == */* ]]; then
    export PORTKEY_MODEL="gpt-4o-mini"
  fi
fi

exec npm run dev
