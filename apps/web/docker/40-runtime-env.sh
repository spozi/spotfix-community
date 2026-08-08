#!/bin/sh
set -eu

GOOGLE_CLIENT_ID_EFFECTIVE="${GOOGLE_CLIENT_ID:-}"
if [ -z "$GOOGLE_CLIENT_ID_EFFECTIVE" ] && [ -n "${GOOGLE_CLIENT_IDS:-}" ]; then
  GOOGLE_CLIENT_ID_EFFECTIVE="$(printf '%s' "$GOOGLE_CLIENT_IDS" | cut -d',' -f1)"
fi

cat >/usr/share/nginx/html/env.js <<EOF
window.__APP_CONFIG__ = {
  API_BASE_URL: "${API_BASE_URL:-http://localhost:5001/api/v1}",
  TENANT_SLUG: "${TENANT_SLUG:-example-campus}",
  GOOGLE_CLIENT_ID: "${GOOGLE_CLIENT_ID_EFFECTIVE}"
};
EOF
