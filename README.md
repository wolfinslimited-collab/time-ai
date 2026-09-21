# Timeless Studio

Source for the AI Studio website at [timelessapp.ai/studio](https://timelessapp.ai/studio) and its Supabase Edge Functions.

## Layout

- `frontend/` — React/TypeScript site (`/studio`, marketing pages, Worker)
- `supabase/` — Edge Functions, shared modules, SQL migrations, config
- `docs/` — Studio deployment, backend, launch, and support docs
- `tool/` — one-off Studio utilities (e.g. buyer-details backfill)

The Supabase project is shared with other Timeless products (mobile app, etc.). Studio-specific functions are prefixed `studio-`; other functions/migrations remain for shared-backend context and deploy history.

## Run frontend

Requires Node.js `>=22.13.0` and pnpm:

```sh
cd frontend
pnpm install
pnpm run dev
```

Open the printed URL and go to `/studio`.

Local Studio functions (Auth/DB stay live):

```sh
./serve-functions.sh          # repo root
cd frontend && pnpm run dev:local-fn
```

## Backend deploy

See `docs/studio_deployment_handoff.md` and `docs/studio_launch_runbook.md`.

```sh
./deploy.sh                   # functions
./deploy.sh --secrets         # also push secrets from .env.production
./deploy.sh --all             # secrets + db + functions
```

Secrets live in `.env.production` (gitignored). Example keys: `supabase/functions/.env.studio.example`.

## Out of scope

Flutter mobile app and Flutter admin portal are not in this repo. Private env files, generated customer media, and runtime caches are excluded.
