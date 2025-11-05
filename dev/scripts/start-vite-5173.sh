#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PORT="5173"

cd "$PROJECT_ROOT"

if command -v lsof >/dev/null 2>&1; then
  pids_on_port="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"

  if [[ -n "${pids_on_port:-}" ]]; then
    echo "Stopping existing process(es) on port $PORT: $pids_on_port"
    while IFS= read -r pid; do
      if [[ -n "$pid" ]]; then
        kill "$pid" 2>/dev/null || true
      fi
    done <<< "$pids_on_port"
    sleep 0.2
  fi
else
  echo "Warning: lsof not available; cannot auto-stop existing processes on port $PORT." >&2
fi

exec npm run dev:5173 -- "$@"
