#!/usr/bin/env bash
#
# Push secrets from .env to Vercel production.
#
# The point of this script is that a secret goes from the file to Vercel and
# nowhere else. It is never echoed, never pasted into a chat window, never in
# your shell history. What it prints instead is a fingerprint — the first eight
# hex characters of the value's SHA-256 — which is enough to confirm that a
# rotated key actually changed, and useless to anyone who reads it.
#
#   bash scripts/sync-secrets.sh                 # push everything below
#   bash scripts/sync-secrets.sh DATABASE_URL    # push only what you name
#
# After a rotation, redeploy — Vercel bakes environment variables in at build
# time, so an existing deployment keeps using the old values until it rebuilds:
#
#   npx vercel --prod
#
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No .env in $(pwd). Copy .env.example and fill it in first." >&2
  exit 1
fi

# Everything the deployment needs. AUTH_GOOGLE_* and ALLOWED_EMAIL_DOMAINS are
# deliberately absent: Google sign-in is not configured in production, and
# pushing empty values would be worse than leaving them unset.
DEFAULT_KEYS=(DATABASE_URL DIRECT_URL AUTH_SECRET AUTH_URL AUTH_RESEND_KEY EMAIL_FROM)

if [ "$#" -gt 0 ]; then
  KEYS=("$@")
else
  KEYS=("${DEFAULT_KEYS[@]}")
fi

fingerprint() {
  printf '%s' "$1" | sha256sum | cut -c1-8
}

# Read one value out of .env without sourcing the file — sourcing would execute
# whatever is in there, and a password containing a backtick is a real thing.
read_env() {
  local key="$1"
  sed -n "s/^${key}=//p" .env | head -1 | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

echo "Pushing to Vercel production. Values are never printed."
echo

for key in "${KEYS[@]}"; do
  value="$(read_env "$key")"

  if [ -z "$value" ]; then
    echo "  $key — not set in .env, skipped"
    continue
  fi

  # Removing first because `vercel env add` will not overwrite. A missing
  # variable makes rm exit non-zero, which is fine and expected on first run.
  npx vercel env rm "$key" production --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | npx vercel env add "$key" production >/dev/null 2>&1

  echo "  $key — set, fingerprint $(fingerprint "$value")"
done

echo
echo "Done. Redeploy to pick these up:  npx vercel --prod"
