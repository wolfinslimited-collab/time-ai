# Timeless Studio (frontend)

Website and Studio UI for [timelessapp.ai](https://timelessapp.ai), including `/studio`.

Built with Next.js on [vinext](https://github.com/cloudflare/vinext) (Cloudflare Workers / OpenAI Sites).

## Prerequisites

- Node.js `>=22.13.0`
- `pnpm`

## Quick start

```bash
pnpm install
pnpm run dev
```

Studio against **local** Supabase functions (Auth/DB stay on the live project):

```bash
# Terminal A (repo root)
./serve-functions.sh

# Terminal B
pnpm run dev:local-fn
```

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm run dev` | Local site; live Studio Edge Functions |
| `pnpm run dev:local-fn` | Local site; proxy Studio functions to `:54321` |
| `pnpm run build` | Production build |
| `pnpm run test` | Build, then run Node tests |
| `pnpm run lint` | ESLint |

## Notes

- Client Supabase config: `app/studio/supabase.ts`
- Hosting identity: `.openai/hosting.json` (OpenAI Sites project)
- Backend deploy is separate — see repo root `deploy.sh` and `docs/`
