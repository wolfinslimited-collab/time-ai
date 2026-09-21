#!/usr/bin/env bash
# Serve Studio Edge Functions locally against the LIVE Supabase project.
# Auth + DB stay on xmxsqmxuiksldqhtugvv; only function code runs on your machine.
#
# Terminal 1:  ./serve-functions.sh
# Terminal 2:  cd frontend && pnpm run dev:local-fn
#
# Requires: Docker Desktop running, and Supabase CLI (or npx).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

ENV_SRC="$ROOT/.env.production"
ENV_DST="$ROOT/supabase/functions/.env"

if [[ ! -f "$ENV_SRC" ]]; then
  echo "Missing $ENV_SRC" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop, then re-run." >&2
  exit 1
fi

if command -v supabase >/dev/null 2>&1; then
  SB=(supabase)
else
  SB=(npx --yes supabase)
fi

# Local serve uses live URL/keys from .env.production so JWT/auth hit production.
# --no-verify-jwt: gateway must not check tokens with the local JWT secret;
# functions authenticate themselves via live SUPABASE_URL + user Bearer token.
mkdir -p "$ROOT/supabase/functions"
{
  echo "# Generated for local functions serve — do not commit"
  grep -E '^[A-Z_][A-Z0-9_]*=' "$ENV_SRC" | sed 's/\r$//'
} > "$ENV_DST"

echo "==> Ensuring local Supabase stack is up (edge runtime)..."
"${SB[@]}" start

echo "==> Serving functions from supabase/functions (live DB/auth via .env)"
echo "    Proxy target for frontend: http://127.0.0.1:54321"
echo "    Frontend cmd: cd frontend && pnpm run dev:local-fn"
echo ""

exec "${SB[@]}" functions serve --env-file "$ENV_DST" --no-verify-jwt
