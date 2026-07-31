#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
guide_port="${BOOKS_GUIDE_PORT:-4177}"
guide_origin="http://127.0.0.1:${guide_port}"
server_pid=""

cleanup() {
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT

cd "$project_root"
npm run build

if ! curl --fail --silent "${guide_origin}/dist/" >/dev/null 2>&1; then
  python3 -m http.server "$guide_port" \
    --bind 127.0.0.1 \
    --directory "$project_root" \
    >"/tmp/books-guide-server-${guide_port}.log" 2>&1 &
  server_pid="$!"
  for _ in {1..40}; do
    if curl --fail --silent "${guide_origin}/dist/" >/dev/null 2>&1; then
      break
    fi
    sleep 0.15
  done
fi

BOOKS_GUIDE_BASE="${guide_origin}/dist/" python3 guide/capture.py "$@"
python3 guide/build_index.py
python3 guide/verify.py --base "${guide_origin}/guide/"

echo "Guide ready at ${guide_origin}/guide/"
