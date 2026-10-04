#!/usr/bin/env bash
# LuauNotes launcher (Linux / macOS)
# Starts the LuauNotes server and opens it in your browser.
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js is required but not installed. Get it from https://nodejs.org" >&2
  exit 1
fi

PORT="${PORT:-4330}"
echo "▶ Starting LuauNotes on http://localhost:${PORT} (Ctrl+C to stop)"
(sleep 1 && (xdg-open "http://localhost:${PORT}" >/dev/null 2>&1 || open "http://localhost:${PORT}" >/dev/null 2>&1 || true)) &
exec node app/server.js
