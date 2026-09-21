# Timeless Studio — Deployment Handoff

Prepared: 19 September 2026

Scope: the AI Studio at `https://timelessapp.ai/studio`. This document does not cover the Flutter mobile apps or the separate admin portal.

## 1. Current deployment

Studio is part of the main Timeless website. Its current production deployment is managed through **OpenAI Sites on Cloudflare Workers**. Deploying this project replaces the website build as a whole, including routes outside `/studio`.

| Setting | Verified value |
| --- | --- |
| Production origin | `https://timelessapp.ai` |
| Studio route | `/studio` |
| Sites project title | `Timeless AI Academy` |
| Sites project ID | `appgprj_6a68efbaf6408191bb64cf1244dfc83f` |
| Sites slug | `timeless-ai-academy` |
| Worker name reported by Sites | `arefnk--timeless-ai-academy` |
| Site status / audience | Active / public |
| Custom domain / SSL status | Active / active |
| Frontend | React, TypeScript, Tailwind CSS, Vinext/Vite using Next.js conventions |
| Runtime configuration | Cloudflare Workers with `nodejs_compat` |
| Node.js requirement | `>=22.13.0` in the inspected package manifest |
| D1 / R2 bindings | Both `null` in the inspected hosting manifest |

Site identity, audience, domain, Worker name, and SSL status were read from the live Sites connector on the preparation date. Build and runtime details were read from local source. The latest saved version reported by Sites was 47; a saved version is not necessarily the current deployed version.

## 2. Cloudflare account and DNS

The workspace's local Wrangler account cache contains:

```text
Account name: Aref@volex.io's Account
Account ID:   0ecfc979bc2e3f59d8eb9cb56991d898
```

**Account ownership of the Sites-managed Worker has not been verified.** This cached account ID is not proof that the production Worker is accessible in that Cloudflare dashboard. A Cloudflare zone ID, direct Worker deployment permission, and a standalone production Wrangler configuration have not been established.

The live Sites custom-domain record returns these DNS targets:

| Record | Name | Target |
| --- | --- | --- |
| A | `@` | `162.159.143.30` |
| A | `@` | `172.66.3.26` |

Sites also supplies `custom-domains.chatgpt.site.` as its CNAME target for subdomains. It is not an instruction to add a CNAME alongside the apex A records. Preserve the existing domain-verification TXT record.

These are the targets returned by Sites, not an independent audit of the DNS zone. Routine deployments through the existing Sites project do not require a DNS change.

## 3. Source code and access

The inspected website source is at this path on the owner's machine:

```text
/Users/arefnk/Documents/Timeless 3/.codex-tmp/timeless-site-src
```

Other local website copies exist. Before developing or publishing, obtain the latest production source revision from the existing Sites project's source repository and reconcile it with the local checkout. Do not assume a temporary local copy is the latest release. The source repository URL and current deployed commit are not recorded in this handoff.

Relevant files, relative to the website checkout:

| Path | Purpose |
| --- | --- |
| `.openai/hosting.json` | Existing Sites project identity and bindings |
| `package.json` / `package-lock.json` | Runtime requirement, scripts, dependencies |
| `vite.config.ts` | Vinext, Cloudflare, and Sites build configuration |
| `worker/index.ts` | Worker entry point, security headers, image handling |
| `app/studio/` | Studio UI and client integration |
| `app/studio/supabase.ts` | Supabase client configuration |
| `build/sites-vite-plugin.ts` | Packaging of Sites metadata into the build |

The hosting manifest currently contains:

```json
{
  "project_id": "appgprj_6a68efbaf6408191bb64cf1244dfc83f",
  "d1": null,
  "r2": null
}
```

Access required:

- Source repository and deployment access to this existing Sites project.
- Supabase access for any backend changes, logs, authentication configuration, or server secrets.
- Cloudflare/DNS access if changing domain routing or moving to direct Workers hosting.
- Stripe and AI-provider access only when working on those integrations.

Obtain credentials through account invitations or a secure secret-sharing channel. No deployment tokens or private keys are included here.

## 4. Build and publish through the existing Sites project

For a normal developer checkout, the inspected package scripts support:

```sh
# Run from the website checkout, not the Flutter repository root.
npm ci
npm run dev
```

To build and run the existing checks:

```sh
npm run lint
npm test
```

The inspected `npm test` script runs `npm run build` followed by the Node test suite. To build alone, use `npm run build`. These commands are documented from source; they were not executed as part of preparing this handoff.

For deployment through Codex Sites, use its current hosting workflow:

1. Select the existing Sites project using the exact project ID above. Confirm the current deployed revision and preserve the public audience.
2. Use the Sites execution-profile and build helpers for the environment. Preserve the project's existing identity and runtime configuration.
3. Commit and push the exact source to the project's bound source repository using an authorized, temporary source credential.
4. Package the matching build with the Sites packaging helper. Server-backed output must include `dist/server/index.js`, emitted static assets, and `dist/.openai/hosting.json`.
5. Save that build as a Sites version associated with the full pushed commit SHA.
6. Deploy the saved version through Sites and wait for successful deployment status.
7. Verify `https://timelessapp.ai/studio` and the shared website routes. Keep the previous successful version available for rollback.

The relevant Sites operations are `get_site`, `list_site_versions`, `create_source_repository_write_credential`, `save_site_version`, `deploy_site_version`, and `get_deployment_status`. Use the installed Sites tooling and its current schemas; this repository is not established as a standalone `wrangler deploy` project.

## 5. Supabase backend

| Setting | Value |
| --- | --- |
| Project reference | `xmxsqmxuiksldqhtugvv` |
| API origin | `https://xmxsqmxuiksldqhtugvv.supabase.co` |
| Edge Functions base | `https://xmxsqmxuiksldqhtugvv.supabase.co/functions/v1` |
| Backend services | PostgreSQL, Auth, Storage, Realtime, TypeScript/Deno Edge Functions |

Backend source lives in the parent Timeless repository under `supabase/functions/` and `supabase/migrations/`. Frontend publication does not deploy those files.

When backend changes are part of a release, review migration history and deploy only the intended changes using the Supabase CLI. The repository contains migrations beyond Studio; inspect pending migrations before running `supabase db push`.

Keep Supabase service-role credentials, AI-provider keys, Stripe secrets, and webhook secrets in the backend secret manager. The browser uses the publishable Supabase client configuration. Preserve Row Level Security, signed asset access, and server-controlled credit charging.

For authentication and payments, preserve or verify:

- Supabase Auth redirect allow-list includes the required Studio return URLs.
- `STUDIO_WEB_URL=https://timelessapp.ai/studio` and the permitted origin matches `https://timelessapp.ai`.
- Stripe webhook endpoint: `https://xmxsqmxuiksldqhtugvv.supabase.co/functions/v1/studio-stripe-webhook`.
- The Worker security policy permits the Supabase HTTPS/WebSocket endpoints and required payment flows.

Consult [Studio launch runbook](studio_launch_runbook.md) for backend secrets, webhook events, and smoke tests. The older [backend handoff](studio_backend_handoff.md) is an architecture reference; its original provider-neutral and Flutter frontend descriptions are not a complete description of the current React site.

## 6. Release checks and rollback

- Load `/studio` directly and refresh it; check sign-in, sign-out, and an authentication return flow.
- Confirm project data, wallet balance, model catalog, and generation history load for the signed-in user.
- Check generation submission, asynchronous updates, and private output access with an approved test budget.
- Verify credit deduction/refund behavior and Stripe Checkout in the appropriate test environment; do not initiate a real payment solely for deployment verification.
- Check shared routes such as the homepage and pricing page after the whole-site deployment.
- Inspect browser errors, Worker logs, and relevant Supabase function logs.

For a frontend rollback, select a previously successful saved Sites version, redeploy it, and verify deployment status. Supabase schema or function changes need their own recovery plan; rolling back the website does not roll back the backend.

## 7. If direct Cloudflare deployment is required

Moving away from Sites is a separate hosting migration. First confirm the destination account and zone, create a dedicated Workers deployment configuration for this Vinext build, configure its assets and required bindings, and test on a separate hostname. Switch production routing only after verification and retain a rollback route to Sites.

The current DNS targets belong to the Sites connection. They do not grant direct Worker deployment access. Do not reuse the reported managed Worker name or cached account ID as proof of an authorized direct deployment target.
