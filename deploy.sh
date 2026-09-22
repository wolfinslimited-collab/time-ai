#!/usr/bin/env bash
# Timeless Studio — deploy backend to live Supabase
# Usage:
#   ./deploy.sh              # deploy Studio Edge Functions
#   ./deploy.sh --secrets    # also push secrets from .env.production
#   ./deploy.sh --db         # also push DB migrations
#   ./deploy.sh --all        # secrets + db + functions
#   ./deploy.sh <fn-name>    # deploy one function (e.g. studio-chat)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env.production"
PROJECT_REF="xmxsqmxuiksldqhtugvv"

STUDIO_FUNCTIONS=(
  studio-upload-url
  studio-create-generation
  studio-preflight
  studio-catalog
  studio-asset-url
  studio-retain-asset
  studio-cleanup
  studio-refresh-generation
  studio-kie-adapter
  studio-provider-webhook
  studio-stripe-checkout
  studio-stripe-webhook
  studio-chat
  studio-support
  studio-support-public
)

DO_FUNCTIONS=1
DO_SECRETS=0
DO_DB=0
ONLY_FN=""

for arg in "$@"; do
  case "$arg" in
    --all) DO_SECRETS=1; DO_DB=1 ;;
    --secrets) DO_SECRETS=1 ;;
    --db) DO_DB=1 ;;
    --help|-h)
      sed -n '2,10p' "$0"
      exit 0
      ;;
    studio-*|delete-account|subscription-lifecycle|video-*|trailer-*|episode-*|verify-*|send-*)
      ONLY_FN="$arg"
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

# Load KEY=VALUE from .env.production (skip comments / blanks)
set -a
# shellcheck disable=SC1090
source <(grep -E '^[A-Z_][A-Z0-9_]*=' "$ENV_FILE" | sed 's/\r$//')
set +a

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "SUPABASE_ACCESS_TOKEN is empty in .env.production" >&2
  exit 1
fi
export SUPABASE_ACCESS_TOKEN

if command -v supabase >/dev/null 2>&1; then
  SB=(supabase)
elif command -v npx >/dev/null 2>&1; then
  SB=(npx --yes supabase)
else
  echo "Install Supabase CLI: brew install supabase/tap/supabase" >&2
  exit 1
fi

echo "==> Project: $PROJECT_REF"
echo "==> Using: ${SB[*]}"

deploy_fn() {
  local name="$1"
  echo "---- deploying $name"
  "${SB[@]}" functions deploy "$name" --project-ref "$PROJECT_REF"
}

if [[ "$DO_SECRETS" -eq 1 ]]; then
  echo "==> Pushing secrets (non-empty Studio keys from .env.production)"
  SECRET_ARGS=()
  for key in \
    KIE_API_KEY \
    WAVESPEED_API_KEY \
    STUDIO_PROVIDER_SUBMIT_URL \
    STUDIO_PROVIDER_API_KEY \
    STUDIO_PROVIDER_WEBHOOK_SECRET \
    STUDIO_CLEANUP_SECRET \
    STUDIO_WEB_URL \
    STUDIO_ALLOWED_ORIGIN \
    STRIPE_SECRET_KEY \
    STRIPE_WEBHOOK_SECRET \
    META_CONVERSIONS_API_ACCESS_TOKEN \
    META_DATASET_ID \
    META_GRAPH_API_VERSION
  do
    val="${!key:-}"
    if [[ -n "$val" ]]; then
      SECRET_ARGS+=("${key}=${val}")
    fi
  done
  if [[ ${#SECRET_ARGS[@]} -eq 0 ]]; then
    echo "No secret values to push (skipped)."
  else
    "${SB[@]}" secrets set --project-ref "$PROJECT_REF" "${SECRET_ARGS[@]}"
  fi
fi

if [[ "$DO_DB" -eq 1 ]]; then
  echo "==> Pushing DB migrations"
  "${SB[@]}" db push --project-ref "$PROJECT_REF"
fi

if [[ -n "$ONLY_FN" ]]; then
  deploy_fn "$ONLY_FN"
elif [[ "$DO_FUNCTIONS" -eq 1 ]]; then
  echo "==> Deploying Studio Edge Functions (${#STUDIO_FUNCTIONS[@]})"
  for name in "${STUDIO_FUNCTIONS[@]}"; do
    deploy_fn "$name"
  done
fi

echo "==> Done."
echo "Live API: https://${PROJECT_REF}.supabase.co/functions/v1/"
