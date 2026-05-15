#!/usr/bin/env bash
# scripts/push-env-to-vercel.sh
#
# Push every variable from `.env` into the linked Vercel project (Production
# environment). Designed to bootstrap the v0.11 closed-bêta deploy where the
# Vercel dashboard still has stale variables from a previous version of the
# app (wrong Stripe price names, leftover NEXTAUTH_*, no R2 / Clerk / etc.).
#
# Behavior:
#   1. Forces NEXT_PUBLIC_APP_URL to the production domain regardless of the
#      local value (which is "localhost:3000" so the app boots in dev).
#   2. Skips variables that don't belong in production (anything matching
#      $SKIP_VARS below) — NEXTAUTH_* are leftovers from an older version
#      of the app, REDIS_URL points at a local container.
#   3. For each remaining variable, runs `vercel env rm` (silent if absent)
#      then `vercel env add` to upsert. The `vercel env` CLI doesn't have a
#      single "upsert" verb, so we do remove-then-add to make the script
#      idempotent.
#
# Pre-requisites:
#   - vercel CLI installed (it is: 50.1.3)
#   - You're logged-in (`vercel login`)
#   - The folder is linked to the right project (`vercel link` once)
#
# Usage:
#   bash scripts/push-env-to-vercel.sh

set -euo pipefail

ENV_FILE=".env"
PROD_DOMAIN="https://aurainfluenceai.com"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ .env not found at project root"
  exit 1
fi

# Variables we intentionally never push to Vercel:
#   - NEXTAUTH_*   → leftover from a previous (NextAuth) version of the app
#   - REDIS_URL    → points at a local Docker container, prod uses Vercel KV
#                    or Upstash — provision separately if/when batch jobs need it
SKIP_VARS=(
  "NEXTAUTH_URL"
  "NEXTAUTH_SECRET"
  "REDIS_URL"
)

is_skipped() {
  local name="$1"
  for skip in "${SKIP_VARS[@]}"; do
    if [[ "$name" == "$skip" ]]; then return 0; fi
  done
  return 1
}

echo "▶ Reading $ENV_FILE …"
echo "▶ Project domain target: $PROD_DOMAIN"
echo

# Parse the .env line by line. We ignore comments and empty lines, then
# split each NAME="VALUE" pair while tolerating both quoted and unquoted
# values. The shell-style approach is simpler than dotenv-parse libraries
# and good enough for our deterministic .env.
while IFS= read -r line || [[ -n "$line" ]]; do
  # Strip CRLF
  line="${line%$'\r'}"
  # Skip comments / blanks
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  # Must contain "="
  [[ "$line" != *=* ]] && continue

  name="${line%%=*}"
  value="${line#*=}"
  # Trim leading/trailing whitespace on the name
  name="$(echo -n "$name" | xargs)"
  # Strip surrounding double or single quotes from the value
  if [[ "$value" =~ ^\".*\"$ ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi

  # Override APP_URL to the prod domain (avoids accidentally pushing
  # http://localhost:3000 to Vercel).
  if [[ "$name" == "NEXT_PUBLIC_APP_URL" ]]; then
    value="$PROD_DOMAIN"
  fi

  if is_skipped "$name"; then
    echo "⏭   skip   $name"
    continue
  fi

  if [[ -z "$value" ]]; then
    echo "⏭   empty  $name"
    continue
  fi

  # Remove existing value silently (the CLI exits non-zero if the var
  # doesn't exist — we don't want that to kill the script).
  vercel env rm "$name" production --yes >/dev/null 2>&1 || true
  # Add the new value (piped to avoid the interactive prompt).
  printf '%s' "$value" | vercel env add "$name" production >/dev/null 2>&1

  echo "✓   set    $name"
done < "$ENV_FILE"

echo
echo "✔ Done. Trigger a redeploy from the Vercel dashboard to pick up the new vars."
